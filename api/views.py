from django.conf import settings
from django.contrib.auth import authenticate, login, logout
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt

from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .auth_utils import get_request_account, is_public_account_post
from .notification_utils import notifications_for_account
from .authentication import RequireSessionTokenAuthentication
from .permissions import IsAuthenticatedSession, IsSuperAdmin, IsSuperAdminOrAdmin, RoleBasedPermission, SuperAdminWritesPermissionMixin
from .services import build_ai_predictions_payload, compute_dashboard_stats, ensure_default_superadmin

import logging

from .models import (
    Account,
    AuditLog,
    Beneficiary,
    BloodBag,
    BloodInventory,
    BloodRequest,
    DisposalLog,
    Donor,
    Hospital,
    HospitalDeliveryRecord,
    Message,
    Notification,
    PendingDonor,
    StorageConfig,
    StorageRoom,
)
from .serializers import (
    AccountLoginSerializer,
    AccountPublicSerializer,
    AccountSerializer,
    ProfileUpdateSerializer,
    AuditLogSerializer,
    BeneficiarySerializer,
    BloodBagSerializer,
    BloodInventorySerializer,
    BloodRequestSerializer,
    DisposalLogSerializer,
    DonorSerializer,
    HospitalDeliveryRecordSerializer,
    HospitalSerializer,
    MessageSerializer,
    NotificationSerializer,
    PendingDonorSerializer,
    StorageConfigSerializer,
    StorageRoomSerializer,
)
from django.core.cache import cache


class SecureAPIView(APIView):
    authentication_classes = [RequireSessionTokenAuthentication]
    permission_classes = [IsAuthenticatedSession, RoleBasedPermission]


@csrf_exempt
@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def login_view(request):
    ensure_default_superadmin()

    serializer = AccountLoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    username = serializer.validated_data['username']
    password = serializer.validated_data['password']

    user = authenticate(request, username=username, password=password)
    if user is None:
        return Response(
            {'success': False, 'authenticated': False, 'detail': 'اسم المستخدم أو كلمة المرور غير صحيحة.'},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    if not request.session.session_key:
        request.session.create()
    login(request, user)
    request.session.modified = True
    request.session.save()
    session_key = request.session.session_key
    if not session_key:
        return Response(
            {'detail': 'تعذر إنشاء جلسة الدخول. أعد المحاولة.'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    account = Account.objects.filter(username=username).first()
    if not account:
        return Response(
            {'detail': 'تعذر العثور على ملف المستخدم بعد تسجيل الدخول.'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    payload = AccountPublicSerializer(account).data
    payload.update({'success': True, 'authenticated': True, 'token': session_key})
    return Response(payload, status=status.HTTP_200_OK)


@method_decorator(csrf_exempt, name='dispatch')
class AccountViewSet(viewsets.ModelViewSet):
    queryset = Account.objects.all()
    serializer_class = AccountSerializer
    lookup_field = 'username'
    authentication_classes = [RequireSessionTokenAuthentication]
    permission_classes = [IsAuthenticatedSession, RoleBasedPermission]

    def get_permissions(self):
        if is_public_account_post(self.request):
            return [AllowAny()]
        action = getattr(self, 'action', None)
        if action in ('register', 'login'):
            return [AllowAny()]
        if action == 'create':
            return [IsAuthenticatedSession(), IsSuperAdmin()]
        if action in ('list', 'retrieve', 'update', 'partial_update', 'destroy'):
            return [IsAuthenticatedSession(), IsSuperAdmin()]
        return [IsAuthenticatedSession(), RoleBasedPermission()]

    def get_authenticators(self):
        if is_public_account_post(self.request):
            return []
        action = getattr(self, 'action', None)
        if action in ('register', 'login'):
            return []
        return super().get_authenticators()

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(
        detail=False,
        methods=['post'],
        url_path='register',
        permission_classes=[AllowAny],
        authentication_classes=[],
    )
    def register(self, request):
        if not settings.DEBUG:
            return Response(
                {'detail': 'التسجيل الذاتي غير متاح على هذا الخادم.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(
        detail=False,
        methods=['post'],
        url_path='login',
        permission_classes=[AllowAny],
        authentication_classes=[],
    )
    def login(self, request):
        ensure_default_superadmin()

        serializer = AccountLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        username = serializer.validated_data['username']
        password = serializer.validated_data['password']

        user = authenticate(request, username=username, password=password)

        if user is None:
            return Response(
                {'detail': 'اسم المستخدم أو كلمة المرور غير صحيحة.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if not request.session.session_key:
            request.session.create()
        login(request, user)
        request.session.modified = True
        request.session.save()
        session_key = request.session.session_key
        if not session_key:
            return Response(
                {'detail': 'تعذر إنشاء جلسة الدخول. أعد المحاولة.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        account = Account.objects.filter(username=username).first()
        if not account:
            return Response(
                {'detail': 'تعذر العثور على ملف المستخدم بعد تسجيل الدخول.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        payload = AccountPublicSerializer(account).data
        payload['success'] = True
        payload['authenticated'] = True
        payload['token'] = session_key
        return Response(payload, status=status.HTTP_200_OK)

    @action(
        detail=False,
        methods=['post'],
        url_path='logout',
        permission_classes=[IsAuthenticatedSession],
    )
    def logout_view(self, request):
        logout(request)
        if hasattr(request, 'session'):
            request.session.flush()
        return Response({'success': True})

    @action(
        detail=False,
        methods=['get', 'patch'],
        url_path='me',
        permission_classes=[IsAuthenticatedSession],
    )
    def me(self, request):
        account = get_request_account(request)
        if not account:
            return Response(
                {'detail': 'يجب تسجيل الدخول أولاً.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        if request.method == 'GET':
            return Response(AccountPublicSerializer(account).data)
        serializer = ProfileUpdateSerializer(account, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        account = serializer.save()
        account.refresh_from_db()
        return Response(AccountPublicSerializer(account).data)


class BloodInventoryViewSet(SuperAdminWritesPermissionMixin, viewsets.ModelViewSet):
    queryset = BloodInventory.objects.all()
    serializer_class = BloodInventorySerializer
    lookup_field = 'blood_type'
    authentication_classes = [RequireSessionTokenAuthentication]
    permission_classes = [IsAuthenticatedSession, RoleBasedPermission]

    @action(detail=False, methods=['get'], url_path='as-dict')
    def as_dict(self, request):
        result = {}
        for item in BloodInventory.objects.all():
            result[item.blood_type] = {
                'available': item.available,
                'reserved': item.reserved,
                'issued': item.issued,
                'expired': item.expired,
                'criticalLimit': item.critical_limit,
            }
        return Response(result)


class DonorViewSet(SuperAdminWritesPermissionMixin, viewsets.ModelViewSet):
    queryset = Donor.objects.all()
    serializer_class = DonorSerializer
    lookup_field = 'donor_id'
    lookup_url_kwarg = 'pk'
    authentication_classes = [RequireSessionTokenAuthentication]
    permission_classes = [IsAuthenticatedSession, RoleBasedPermission]


class BloodBagViewSet(SuperAdminWritesPermissionMixin, viewsets.ModelViewSet):
    queryset = BloodBag.objects.all()
    serializer_class = BloodBagSerializer
    lookup_field = 'bag_id'
    lookup_url_kwarg = 'pk'
    authentication_classes = [RequireSessionTokenAuthentication]
    permission_classes = [IsAuthenticatedSession, RoleBasedPermission]


class PendingDonorViewSet(SuperAdminWritesPermissionMixin, viewsets.ModelViewSet):
    queryset = PendingDonor.objects.select_related('bag').all()
    serializer_class = PendingDonorSerializer
    lookup_field = 'bag_id'
    authentication_classes = [RequireSessionTokenAuthentication]
    permission_classes = [IsAuthenticatedSession, RoleBasedPermission]

    @action(detail=False, methods=['get'], url_path='as-dict')
    def as_dict(self, request):
        result = {}
        for item in PendingDonor.objects.select_related('bag').all():
            result[item.bag_id] = PendingDonorSerializer(item).data
            result[item.bag_id].pop('bagId', None)
        return Response(result)


class BloodRequestViewSet(SuperAdminWritesPermissionMixin, viewsets.ModelViewSet):
    queryset = BloodRequest.objects.all()
    serializer_class = BloodRequestSerializer
    lookup_field = 'request_id'
    lookup_url_kwarg = 'pk'
    authentication_classes = [RequireSessionTokenAuthentication]
    permission_classes = [IsAuthenticatedSession, RoleBasedPermission]


class HospitalViewSet(SuperAdminWritesPermissionMixin, viewsets.ModelViewSet):
    queryset = Hospital.objects.all()
    serializer_class = HospitalSerializer
    lookup_field = 'name'
    authentication_classes = [RequireSessionTokenAuthentication]
    permission_classes = [IsAuthenticatedSession, RoleBasedPermission]


class HospitalDeliveryRecordViewSet(SuperAdminWritesPermissionMixin, viewsets.ModelViewSet):
    queryset = HospitalDeliveryRecord.objects.all()
    serializer_class = HospitalDeliveryRecordSerializer
    lookup_field = 'record_id'
    lookup_url_kwarg = 'pk'
    authentication_classes = [RequireSessionTokenAuthentication]
    permission_classes = [IsAuthenticatedSession, RoleBasedPermission]


class DisposalLogViewSet(SuperAdminWritesPermissionMixin, viewsets.ModelViewSet):
    queryset = DisposalLog.objects.all()
    serializer_class = DisposalLogSerializer
    authentication_classes = [RequireSessionTokenAuthentication]
    permission_classes = [IsAuthenticatedSession, RoleBasedPermission]


class AuditLogViewSet(viewsets.ModelViewSet):
    queryset = AuditLog.objects.select_related('account').all()
    serializer_class = AuditLogSerializer
    authentication_classes = [RequireSessionTokenAuthentication]

    def get_permissions(self):
        action = getattr(self, 'action', None)
        if action in ('list', 'retrieve'):
            return [IsAuthenticatedSession(), IsSuperAdmin()]
        if action == 'create':
            return [IsAuthenticatedSession(), RoleBasedPermission()]
        return [IsAuthenticatedSession(), IsSuperAdmin()]


class NotificationViewSet(viewsets.ModelViewSet):
    queryset = Notification.objects.all()
    serializer_class = NotificationSerializer
    authentication_classes = [RequireSessionTokenAuthentication]
    permission_classes = [IsAuthenticatedSession, RoleBasedPermission]

    def get_queryset(self):
        return notifications_for_account(get_request_account(self.request))

    def perform_destroy(self, instance):
        account = get_request_account(self.request)
        if not account:
            instance.delete()
            return
        deleted = list(instance.deleted_by or [])
        if account.username not in deleted:
            deleted.append(account.username)
            instance.deleted_by = deleted
            instance.save(update_fields=['deleted_by'])

    def perform_update(self, serializer):
        account = get_request_account(self.request)
        mark_read = self.request.data.get('read')
        if account and mark_read is True:
            instance = serializer.instance
            read_by = list(instance.read_by or [])
            if account.username not in read_by:
                read_by.append(account.username)
                instance.read_by = read_by
                instance.save(update_fields=['read_by'])
            return
        serializer.save()


class MessageViewSet(viewsets.ModelViewSet):
    queryset = Message.objects.select_related('sender').all()
    serializer_class = MessageSerializer
    authentication_classes = [RequireSessionTokenAuthentication]
    permission_classes = [IsAuthenticatedSession, RoleBasedPermission]

    def get_permissions(self):
        action = getattr(self, 'action', None)
        if action == 'destroy':
            return [IsAuthenticatedSession(), IsSuperAdmin()]
        if action in ('update', 'partial_update'):
            seen_only = set(self.request.data.keys()) <= {'seenBy', 'seen_by', 'time', 'text'}
            if seen_only and ('seenBy' in self.request.data or 'seen_by' in self.request.data):
                return [IsAuthenticatedSession(), RoleBasedPermission()]
            return [IsAuthenticatedSession(), IsSuperAdmin()]
        return super().get_permissions()

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context


class StorageRoomViewSet(SuperAdminWritesPermissionMixin, viewsets.ModelViewSet):
    queryset = StorageRoom.objects.prefetch_related('fridge_set').all()
    serializer_class = StorageRoomSerializer
    lookup_field = 'room'
    authentication_classes = [RequireSessionTokenAuthentication]
    permission_classes = [IsAuthenticatedSession, RoleBasedPermission]


class StorageConfigViewSet(SuperAdminWritesPermissionMixin, viewsets.ViewSet):
    singleton_pk = 'default'
    authentication_classes = [RequireSessionTokenAuthentication]
    permission_classes = [IsAuthenticatedSession, RoleBasedPermission]

    def _get_config(self):
        config, _ = StorageConfig.objects.get_or_create(pk=self.singleton_pk)
        return config

    def list(self, request):
        config = self._get_config()
        return Response(StorageConfigSerializer(config).data)

    def retrieve(self, request, pk=None):
        config = self._get_config()
        return Response(StorageConfigSerializer(config).data)

    def create(self, request):
        config = self._get_config()
        serializer = StorageConfigSerializer(config, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(StorageConfigSerializer(config).data)

    def update(self, request, pk=None):
        config = self._get_config()
        serializer = StorageConfigSerializer(config, data=request.data, partial=False)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(StorageConfigSerializer(config).data)

    def partial_update(self, request, pk=None):
        config = self._get_config()
        serializer = StorageConfigSerializer(config, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(StorageConfigSerializer(config).data)


class BootstrapView(SecureAPIView):
    def get(self, request):
        try:
            # cache bootstrap payload briefly to reduce DB & serialization load
            account = get_request_account(request)
            cache_key = f'bootstrap_payload_{account.username if account else "anon"}'
            cached = cache.get(cache_key)
            if cached is not None:
                return Response(cached)
            account = get_request_account(request)
            config = StorageConfig.objects.filter(pk='default').first()
            pending_dict = {}
            for item in PendingDonor.objects.select_related('bag').all():
                pending_dict[item.bag_id] = {
                    'name': item.name,
                    'nationalId': item.national_id,
                    'age': item.age,
                    'phone': item.phone,
                    'address': item.address,
                    'room': item.room,
                    'fridge': item.fridge,
                }

            blood_inventory = {}
            for item in BloodInventory.objects.all():
                blood_inventory[item.blood_type] = {
                    'available': item.available,
                    'reserved': item.reserved,
                    'issued': item.issued,
                    'expired': item.expired,
                    'criticalLimit': item.critical_limit,
                }

            # Build a lighter payload for large lists to reduce serialization overhead
            blood_bags_qs = BloodBag.objects.all().values(
                'bag_id', 'donor', 'blood_type', 'qty', 'date', 'expiry', 'location', 'status'
            )
            blood_bags = []
            for b in blood_bags_qs:
                blood_bags.append({
                    'id': b['bag_id'],
                    'donor': b['donor'],
                    'bloodType': b['blood_type'],
                    'qty': b['qty'],
                    'date': b['date'].isoformat() if b['date'] else None,
                    'expiry': b['expiry'].isoformat() if b['expiry'] else None,
                    'location': b['location'],
                    'status': b['status'],
                })

            donors_qs = Donor.objects.all().values(
                'donor_id', 'name', 'national_id', 'blood', 'phone', 'age', 'address', 'status', 'total_count', 'last_date'
            )
            donors = []
            for d in donors_qs:
                donors.append({
                    'id': d['donor_id'],
                    'name': d['name'],
                    'nationalId': d['national_id'],
                    'blood': d['blood'],
                    'phone': d['phone'],
                    'age': d['age'],
                    'address': d['address'],
                    'status': d['status'],
                    'totalCount': d['total_count'],
                    'lastDate': d['last_date'].isoformat() if d['last_date'] else None,
                })

            requests_qs = BloodRequest.objects.all().values('request_id', 'hospital', 'blood', 'qty', 'priority', 'status')
            requests = [
                {'id': r['request_id'], 'hospital': r['hospital'], 'blood': r['blood'], 'qty': r['qty'], 'priority': r['priority'], 'status': r['status']}
                for r in requests_qs
            ]

            hospitals = Hospital.objects.all().values('name', 'address', 'manager', 'phone', 'status')
            hospitals = [dict(h) for h in hospitals]

            hospital_delivery_qs = HospitalDeliveryRecord.objects.all().values(
                'record_id', 'hospital', 'blood', 'qty', 'priority', 'recipient', 'recipient_phone', 'delivery_notes', 'delivered_by', 'delivered_at'
            )
            hospital_delivery_records = []
            for r in hospital_delivery_qs:
                hospital_delivery_records.append({
                    'id': r['record_id'],
                    'hospital': r['hospital'],
                    'blood': r['blood'],
                    'qty': r['qty'],
                    'priority': r['priority'],
                    'recipient': r['recipient'],
                    'recipientPhone': r['recipient_phone'],
                    'deliveryNotes': r['delivery_notes'],
                    'deliveredBy': r['delivered_by'],
                    'deliveredAt': r['delivered_at'].isoformat() if r['delivered_at'] else None,
                })

            disposal_qs = DisposalLog.objects.all().values('bag_code', 'disposal_type', 'blood', 'date', 'reason', 'worker')
            disposal_logs = [
                {'id': d['bag_code'], 'type': d['disposal_type'], 'blood': d['blood'], 'date': d['date'].isoformat() if d['date'] else None, 'reason': d['reason'], 'worker': d['worker']}
                for d in disposal_qs
            ]

            # Limit audit logs & messages to recent N entries to avoid huge payloads
            audit_logs = []
            messages_list = []
            if account and account.role == 'superadmin':
                for a in AuditLog.objects.select_related('account').order_by('-pk')[:500]:
                    audit_logs.append(AuditLogSerializer(a).data)
            for m in Message.objects.select_related('sender').order_by('-pk')[:500]:
                messages_list.append(MessageSerializer(m).data)

            storage_units = StorageRoomSerializer(StorageRoom.objects.prefetch_related('fridge_set').all(), many=True).data

            payload = {
                'bloodInventory': blood_inventory,
                'bloodBags': blood_bags,
                'donors': donors,
                'requests': requests,
                'hospitals': hospitals,
                'hospitalDeliveryRecords': hospital_delivery_records,
                'disposalLogs': disposal_logs,
                'auditLogs': audit_logs,
                'notifications': NotificationSerializer(
                    notifications_for_account(account),
                    many=True,
                    context={'request': request},
                ).data,
                'messages': messages_list,
                'storageUnits': storage_units,
                'accounts': [],
                'storageConfig': StorageConfigSerializer(config).data if config else None,
                'pendingDonors': pending_dict,
            }

            if account:
                payload['currentSession'] = {
                    'username': account.username,
                    'role': account.role,
                    'name': account.name,
                    'email': account.email or '',
                    'is_superuser': account.role == 'superadmin',
                }

            if account and account.role in ('superadmin', 'admin'):
                payload['accounts'] = AccountSerializer(Account.objects.all(), many=True).data

            if account and account.role == 'superadmin':
                payload['auditLogs'] = AuditLogSerializer(
                    AuditLog.objects.select_related('account').all(), many=True
                ).data

            payload['dashboardStats'] = compute_dashboard_stats()
            # do not include full beneficiaries list in bootstrap to reduce payload
            # frontend will request beneficiaries via paginated endpoint
            payload['beneficiaries'] = []
            # cache briefly (10 seconds) to help under load
            cache.set(cache_key, payload, 10)
            return Response(payload)
        except Exception as exc:
            logging.exception('Failed building bootstrap payload')
            return Response(
                {
                    'detail': 'تعذر تحميل بيانات bootstrap. حاول التحديث أو تواصل مع الدعم.',
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class LiveSyncView(SecureAPIView):
    def get(self, request):
        try:
            account = get_request_account(request)
            cache_key = f'live_sync_payload_{account.username if account else "anon"}'
            cached = cache.get(cache_key)
            if cached is not None:
                return Response(cached)

            blood_inventory = {
                item.blood_type: {
                    'available': item.available,
                    'reserved': item.reserved,
                    'issued': item.issued,
                    'expired': item.expired,
                    'criticalLimit': item.critical_limit,
                }
                for item in BloodInventory.objects.all()
            }

            blood_bags = []
            for b in BloodBag.objects.all().values(
                'bag_id', 'donor', 'blood_type', 'qty', 'date', 'expiry', 'location', 'status'
            ):
                blood_bags.append({
                    'id': b['bag_id'],
                    'donor': b['donor'],
                    'bloodType': b['blood_type'],
                    'qty': b['qty'],
                    'date': b['date'].isoformat() if b['date'] else None,
                    'expiry': b['expiry'].isoformat() if b['expiry'] else None,
                    'location': b['location'],
                    'status': b['status'],
                })

            donors = []
            for d in Donor.objects.all().values(
                'donor_id', 'name', 'national_id', 'blood', 'phone', 'age', 'address', 'status', 'total_count', 'last_date'
            ):
                donors.append({
                    'id': d['donor_id'],
                    'name': d['name'],
                    'nationalId': d['national_id'],
                    'blood': d['blood'],
                    'phone': d['phone'],
                    'age': d['age'],
                    'address': d['address'],
                    'status': d['status'],
                    'totalCount': d['total_count'],
                    'lastDate': d['last_date'].isoformat() if d['last_date'] else None,
                })

            requests_qs = BloodRequest.objects.all().values(
                'request_id', 'hospital', 'blood', 'qty', 'priority', 'status'
            )
            requests = [
                {
                    'id': r['request_id'],
                    'hospital': r['hospital'],
                    'blood': r['blood'],
                    'qty': r['qty'],
                    'priority': r['priority'],
                    'status': r['status'],
                }
                for r in requests_qs
            ]

            hospitals = [dict(h) for h in Hospital.objects.all().values('name', 'address', 'manager', 'phone', 'status')]

            hospital_delivery_records = []
            for r in HospitalDeliveryRecord.objects.all().values(
                'record_id', 'hospital', 'blood', 'qty', 'priority', 'recipient', 'recipient_phone',
                'delivery_notes', 'delivered_by', 'delivered_at',
            ):
                hospital_delivery_records.append({
                    'id': r['record_id'],
                    'hospital': r['hospital'],
                    'blood': r['blood'],
                    'qty': r['qty'],
                    'priority': r['priority'],
                    'recipient': r['recipient'],
                    'recipientPhone': r['recipient_phone'],
                    'deliveryNotes': r['delivery_notes'],
                    'deliveredBy': r['delivered_by'],
                    'deliveredAt': r['delivered_at'].isoformat() if r['delivered_at'] else None,
                })

            disposal_logs = [
                {
                    'id': d['bag_code'],
                    'type': d['disposal_type'],
                    'blood': d['blood'],
                    'date': d['date'].isoformat() if d['date'] else None,
                    'reason': d['reason'],
                    'worker': d['worker'],
                }
                for d in DisposalLog.objects.all().values('bag_code', 'disposal_type', 'blood', 'date', 'reason', 'worker')
            ]

            messages_qs = Message.objects.select_related('sender').order_by('-pk')[:200]
            messages_list = [MessageSerializer(m).data for m in reversed(messages_qs)]

            storage_units = StorageRoomSerializer(
                StorageRoom.objects.prefetch_related('fridge_set').all(),
                many=True,
            ).data

            beneficiaries = BeneficiarySerializer(Beneficiary.objects.all().order_by('-created_at', '-pk'), many=True).data

            payload = {
                'bloodInventory': blood_inventory,
                'bloodBags': blood_bags,
                'donors': donors,
                'requests': requests,
                'hospitals': hospitals,
                'hospitalDeliveryRecords': hospital_delivery_records,
                'disposalLogs': disposal_logs,
                'beneficiaries': beneficiaries,
                'storageUnits': storage_units,
                'notifications': NotificationSerializer(
                    notifications_for_account(account),
                    many=True,
                    context={'request': request},
                ).data,
                'messages': messages_list,
                'dashboardStats': compute_dashboard_stats(),
            }

            if account and account.role == 'superadmin':
                payload['auditLogs'] = AuditLogSerializer(
                    AuditLog.objects.select_related('account').order_by('-pk')[:500],
                    many=True,
                ).data

            if account:
                payload['currentSession'] = {
                    'username': account.username,
                    'role': account.role,
                    'name': account.name,
                    'email': account.email or '',
                    'is_superuser': account.role == 'superadmin',
                }

            cache.set(cache_key, payload, 3)
            return Response(payload)
        except Exception as exc:
            logging.exception('Failed building live sync payload')
            return Response(
                {
                    'detail': 'تعذر تحميل بيانات التزامن الحية. حاول التحديث أو تواصل مع الدعم.',
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class DashboardStatsView(SecureAPIView):
    def get(self, request):
        return Response(compute_dashboard_stats())


class BeneficiaryViewSet(SuperAdminWritesPermissionMixin, viewsets.ModelViewSet):
    queryset = Beneficiary.objects.all()
    serializer_class = BeneficiarySerializer
    authentication_classes = [RequireSessionTokenAuthentication]
    permission_classes = [IsAuthenticatedSession, RoleBasedPermission]

    def get_permissions(self):
        action = getattr(self, 'action', None)
        if action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsAuthenticatedSession(), IsSuperAdminOrAdmin()]
        return [IsAuthenticatedSession(), RoleBasedPermission()]

    def list(self, request, *args, **kwargs):
        # support simple pagination via ?page=<n>&page_size=<m>
        qs = self.get_queryset().order_by('-created_at', '-pk')
        try:
            page = int(request.query_params.get('page', 1))
        except Exception:
            page = 1
        try:
            page_size = int(request.query_params.get('page_size', 50))
        except Exception:
            page_size = 50
        if page_size <= 0:
            page_size = 50
        total = qs.count()
        start = (max(1, page) - 1) * page_size
        end = start + page_size
        items = qs[start:end]
        serializer = self.get_serializer(items, many=True)
        return Response({'results': serializer.data, 'count': total, 'page': page, 'page_size': page_size})


class AiPredictionsView(SecureAPIView):
    def get(self, request):
        return Response(build_ai_predictions_payload())


class TestAPIView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({'message': 'Hello from Django'})
