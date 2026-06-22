from django.conf import settings
from django.contrib.auth import authenticate, login, logout
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt

from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .auth_utils import account_context_from_request, get_request_account, is_public_account_post
from .message_utils import get_super_admin_contact, messages_queryset_for_account
from .notification_utils import notifications_for_account
from .authentication import RequireSessionTokenAuthentication
from .permissions import IsAuthenticatedSession, IsSuperAdmin, IsSuperAdminOrAdmin, RoleBasedPermission, SuperAdminWritesPermissionMixin
from .role_utils import get_role_label, normalize_role_code
from .blood_constants import build_inventory_payload
from .services import (
    build_ai_predictions_payload,
    compute_blood_output_stats,
    compute_dashboard_stats,
    delete_bag,
    ensure_default_superadmin,
    push_audit,
    remove_default_it_account,
    sync_storage_from_bags,
)

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
    SampleAnalysis,
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
    SampleAnalysisSerializer,
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
    remove_default_it_account()

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

    def destroy(self, request, *args, **kwargs):
        from .services import PROTECTED_USERNAMES

        instance = self.get_object()
        if instance.username in PROTECTED_USERNAMES:
            return Response(
                {'detail': 'لا يمكن حذف هذا الحساب المحمي.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().destroy(request, *args, **kwargs)

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
        remove_default_it_account()

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
    http_method_names = ['get', 'head', 'options', 'patch', 'put']

    def create(self, request, *args, **kwargs):
        return Response(
            {'detail': 'لا يمكن إنشاء مخزون يدوياً — يُدار عبر عمليات النظام.'},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    def destroy(self, request, *args, **kwargs):
        return Response(
            {'detail': 'لا يمكن حذف سجل مخزون — استخدم عمليات النظام.'},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    def update(self, request, *args, **kwargs):
        allowed_keys = {'criticalLimit', 'critical_limit', 'bloodType', 'blood_type'}
        if not set(request.data.keys()).issubset(allowed_keys):
            return Response(
                {
                    'detail': (
                        'يُسمح بتعديل حد الخطر (criticalLimit) فقط. '
                        'العدادات تُحدَّث تلقائياً من الأكياس والعمليات.'
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        kwargs['partial'] = True
        return super().update(request, *args, **kwargs)

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
    queryset = BloodBag.objects.filter(status__in=['Pending', 'Approved', 'Reserved'])
    serializer_class = BloodBagSerializer
    lookup_field = 'bag_id'
    lookup_url_kwarg = 'pk'
    authentication_classes = [RequireSessionTokenAuthentication]
    permission_classes = [IsAuthenticatedSession, RoleBasedPermission]
    http_method_names = ['get', 'head', 'options', 'delete']

    def create(self, request, *args, **kwargs):
        return Response(
            {'detail': 'استخدم /api/operations/add-donation/ لإضافة أكياس.'},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    def update(self, request, *args, **kwargs):
        return Response(
            {'detail': 'استخدم عمليات النظام (تسليم/اتلاف/نقل) لتعديل الأكياس.'},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    def destroy(self, request, *args, **kwargs):
        bag = self.get_object()
        username, role, _user_name = account_context_from_request(request, request.data or {})
        try:
            delete_bag(bag.bag_id, username, role)
            return Response(status=status.HTTP_204_NO_CONTENT)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)


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

    def perform_create(self, serializer):
        account = get_request_account(self.request)
        request_obj = serializer.save()
        if account:
            push_audit(
                account.username,
                account.get_role_code(),
                'إنشاء طلب مستشفى',
                f'طلب {request_obj.request_id} — {request_obj.hospital} ({request_obj.blood}) × {request_obj.qty}. الحالة: {request_obj.status}.',
            )


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


class SampleAnalysisViewSet(viewsets.ModelViewSet):
    """ViewSet لإدارة تحليل العينات
    - المعمل (lab) و السوبر أدمن فقط
    """
    queryset = SampleAnalysis.objects.all()
    serializer_class = SampleAnalysisSerializer
    lookup_field = 'bag_id'
    lookup_url_kwarg = 'pk'
    authentication_classes = [RequireSessionTokenAuthentication]
    permission_classes = [IsAuthenticatedSession, RoleBasedPermission]

    def get_permissions(self):
        """السماح بالوصول للمعمل والسوبر أدمن فقط"""
        account = get_request_account(self.request)
        if not account:
            return [IsAuthenticatedSession()]
        
        role = normalize_role_code(account.role_code or account.role)
        if role not in ('DR', 'MLS'):  # DR = Super Admin, MLS = Lab
            return [IsAuthenticatedSession(), IsSuperAdmin()]
        
        return super().get_permissions()

    def perform_create(self, serializer):
        account = get_request_account(self.request)
        instance = serializer.save(analyzed_by=account)
        if account:
            push_audit(
                account.username,
                account.get_role_code(),
                'إنشاء تحليل عينة',
                f'عينة {instance.bag_id} - حالة: {instance.status}',
            )

    def perform_update(self, serializer):
        """عند تحديث التحليل (قبول/رفض) — يمر عبر submit_lab_result لضمان التكامل."""
        from django.utils import timezone

        account = get_request_account(self.request)
        previous = serializer.instance
        previous_status = previous.status

        instance = serializer.save(
            analyzed_by=account or previous.analyzed_by,
            analyzed_at=timezone.now(),
        )

        if instance.status in ('Approved', 'Rejected') and previous_status != instance.status:
            from .services import submit_lab_result

            try:
                submit_lab_result(
                    bag_id=instance.bag_id,
                    decision=instance.status,
                    final_type=instance.confirmed_blood_type,
                    reason=instance.rejection_reason,
                    user_name=(account.name if account else '') or (account.username if account else 'system'),
                    username=account.username if account else 'system',
                    role=account.get_role_code() if account else 'DR',
                    diseases=instance.detected_diseases,
                )
                action_msg = (
                    f'قبول عينة {instance.bag_id} - فصيلة: {instance.confirmed_blood_type}'
                    if instance.status == 'Approved'
                    else f'رفض عينة {instance.bag_id}'
                )
            except ValueError as exc:
                action_msg = f'تحديث عينة {instance.bag_id}: {exc}'
        else:
            action_msg = f'تحديث حالة عينة {instance.bag_id} إلى: {instance.status}'

        if account:
            push_audit(
                account.username,
                account.get_role_code(),
                'تحديث تحليل عينة',
                action_msg,
            )


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
    serializer_class = MessageSerializer
    authentication_classes = [RequireSessionTokenAuthentication]
    permission_classes = [IsAuthenticatedSession, RoleBasedPermission]

    def get_queryset(self):
        from .message_utils import messages_queryset_for_account

        account = get_request_account(self.request)
        qs = Message.objects.select_related('sender', 'recipient').all()
        return messages_queryset_for_account(qs, account)

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
    http_method_names = ['get', 'head', 'options']

    def create(self, request, *args, **kwargs):
        return Response(
            {'detail': 'استخدم /api/operations/save-storage-config/ لتعديل التخزين.'},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    def update(self, request, *args, **kwargs):
        return Response(
            {'detail': 'سعة التخزين تُحدَّث تلقائياً من الأكياس — استخدم save-storage-config للهيكل.'},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    def destroy(self, request, *args, **kwargs):
        return Response(
            {'detail': 'لا يمكن حذف وحدات التخزين يدوياً.'},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )


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

            blood_inventory = build_inventory_payload()

            blood_bags_qs = BloodBag.objects.filter(
                status__in=['Pending', 'Approved', 'Reserved'],
            ).values(
                'bag_id', 'donor', 'blood_type', 'product_type', 'qty', 'date', 'expiry', 'location', 'status'
            )
            blood_bags = []
            for b in blood_bags_qs:
                blood_bags.append({
                    'id': b['bag_id'],
                    'donor': b['donor'],
                    'bloodType': b['blood_type'],
                    'productType': b['product_type'],
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

            requests_qs = BloodRequest.objects.all().values(
                'request_id', 'hospital', 'blood', 'product_type', 'qty', 'priority', 'status', 'reserved_bag_ids'
            )
            requests = [
                {
                    'id': r['request_id'],
                    'hospital': r['hospital'],
                    'blood': r['blood'],
                    'productType': r['product_type'],
                    'qty': r['qty'],
                    'priority': r['priority'],
                    'status': r['status'],
                    'reservedBagIds': r['reserved_bag_ids'] or [],
                }
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

            disposal_logs = [
                DisposalLogSerializer(d).data
                for d in DisposalLog.objects.all().order_by('-pk')[:500]
            ]

            # Limit audit logs & messages to recent N entries to avoid huge payloads
            audit_logs = []
            messages_list = []
            if account and normalize_role_code(account.role_code or account.role) == 'DR':
                for a in AuditLog.objects.select_related('account').order_by('-pk')[:500]:
                    audit_logs.append(AuditLogSerializer(a).data)
            if account:
                msg_qs = messages_queryset_for_account(
                    Message.objects.select_related('sender', 'recipient').order_by('-pk'),
                    account,
                )[:500]
                messages_list = [MessageSerializer(m).data for m in msg_qs]

            sync_storage_from_bags()
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
                    'role_code': account.role_code or account.role,
                    'role_label': get_role_label(account.role_code or account.role),
                    'name': account.name,
                    'email': account.email or '',
                    'phone': account.phone or '',
                    'is_superuser': normalize_role_code(account.role_code or account.role) == 'DR',
                }
                super_contact = get_super_admin_contact()
                if super_contact:
                    payload['superAdminContact'] = super_contact

            if account and normalize_role_code(account.role_code or account.role) == 'DR':
                payload['accounts'] = AccountSerializer(Account.objects.all(), many=True).data

            if account and normalize_role_code(account.role_code or account.role) == 'DR':
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
                    'detail': 'تعذر تحميل بيانات النظام. حاول التحديث أو تواصل مع الدعم.',
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class LiveSyncView(SecureAPIView):
    def get(self, request):
        try:
            account = get_request_account(request)

            blood_inventory = build_inventory_payload()

            blood_bags = []
            for b in BloodBag.objects.filter(
                status__in=['Pending', 'Approved', 'Reserved'],
            ).values(
                'bag_id', 'donor', 'blood_type', 'product_type', 'qty', 'date', 'expiry', 'location', 'status'
            ):
                blood_bags.append({
                    'id': b['bag_id'],
                    'donor': b['donor'],
                    'bloodType': b['blood_type'],
                    'productType': b['product_type'],
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
                'request_id', 'hospital', 'blood', 'product_type', 'qty', 'priority', 'status', 'reserved_bag_ids'
            )
            requests = [
                {
                    'id': r['request_id'],
                    'hospital': r['hospital'],
                    'blood': r['blood'],
                    'productType': r['product_type'],
                    'qty': r['qty'],
                    'priority': r['priority'],
                    'status': r['status'],
                    'reservedBagIds': r['reserved_bag_ids'] or [],
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
                DisposalLogSerializer(d).data
                for d in DisposalLog.objects.all().order_by('-pk')[:500]
            ]

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

            config = StorageConfig.objects.filter(pk='default').first()

            messages_qs = messages_queryset_for_account(
                Message.objects.select_related('sender', 'recipient').order_by('-pk'),
                account,
            )[:200]
            messages_list = [MessageSerializer(m).data for m in reversed(messages_qs)]

            sync_storage_from_bags()
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
                'pendingDonors': pending_dict,
                'storageConfig': StorageConfigSerializer(config).data if config else None,
                'notifications': NotificationSerializer(
                    notifications_for_account(account),
                    many=True,
                    context={'request': request},
                ).data,
                'messages': messages_list,
                'dashboardStats': compute_dashboard_stats(),
            }

            if account and normalize_role_code(account.role_code or account.role) == 'DR':
                payload['auditLogs'] = AuditLogSerializer(
                    AuditLog.objects.select_related('account').order_by('-pk')[:500],
                    many=True,
                ).data
                payload['accounts'] = AccountSerializer(Account.objects.all(), many=True).data

            if account:
                payload['currentSession'] = {
                    'username': account.username,
                    'role': account.role,
                    'role_code': account.role_code or account.role,
                    'role_label': get_role_label(account.role_code or account.role),
                    'name': account.name,
                    'email': account.email or '',
                    'phone': account.phone or '',
                    'is_superuser': normalize_role_code(account.role_code or account.role) == 'DR',
                }
                super_contact = get_super_admin_contact()
                if super_contact:
                    payload['superAdminContact'] = super_contact

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
