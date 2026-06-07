from django.conf import settings
from django.contrib.auth import authenticate, login, logout
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .auth_utils import get_request_account, is_public_account_post
from .notification_utils import notifications_for_account
from .authentication import RequireSessionTokenAuthentication
from .permissions import IsSuperAdmin, RoleBasedPermission
from .services import build_ai_predictions_payload, ensure_default_superadmin

from .models import (
    Account,
    AuditLog,
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


class SecureAPIView(APIView):
    authentication_classes = [RequireSessionTokenAuthentication]
    permission_classes = [IsAuthenticated, RoleBasedPermission]


@method_decorator(csrf_exempt, name='dispatch')
class AccountViewSet(viewsets.ModelViewSet):
    queryset = Account.objects.all()
    serializer_class = AccountSerializer
    lookup_field = 'username'
    authentication_classes = [RequireSessionTokenAuthentication]
    permission_classes = [IsAuthenticated, RoleBasedPermission]

    def get_permissions(self):
        if is_public_account_post(self.request):
            return [AllowAny()]
        action = getattr(self, 'action', None)
        if action in ('register', 'login'):
            return [AllowAny()]
        if action == 'create':
            return [IsAuthenticated(), IsSuperAdmin()]
        if action in ('list', 'retrieve', 'update', 'partial_update', 'destroy'):
            return [IsAuthenticated(), IsSuperAdmin()]
        return [IsAuthenticated(), RoleBasedPermission()]

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

        login(request, user)
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
        permission_classes=[IsAuthenticated],
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
        permission_classes=[IsAuthenticated],
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


class BloodInventoryViewSet(viewsets.ModelViewSet):
    queryset = BloodInventory.objects.all()
    serializer_class = BloodInventorySerializer
    lookup_field = 'blood_type'
    authentication_classes = [RequireSessionTokenAuthentication]
    permission_classes = [IsAuthenticated, RoleBasedPermission]

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


class DonorViewSet(viewsets.ModelViewSet):
    queryset = Donor.objects.all()
    serializer_class = DonorSerializer
    lookup_field = 'donor_id'
    lookup_url_kwarg = 'pk'
    authentication_classes = [RequireSessionTokenAuthentication]
    permission_classes = [IsAuthenticated, RoleBasedPermission]


class BloodBagViewSet(viewsets.ModelViewSet):
    queryset = BloodBag.objects.all()
    serializer_class = BloodBagSerializer
    lookup_field = 'bag_id'
    lookup_url_kwarg = 'pk'
    authentication_classes = [RequireSessionTokenAuthentication]
    permission_classes = [IsAuthenticated, RoleBasedPermission]


class PendingDonorViewSet(viewsets.ModelViewSet):
    queryset = PendingDonor.objects.select_related('bag').all()
    serializer_class = PendingDonorSerializer
    lookup_field = 'bag_id'
    authentication_classes = [RequireSessionTokenAuthentication]
    permission_classes = [IsAuthenticated, RoleBasedPermission]

    @action(detail=False, methods=['get'], url_path='as-dict')
    def as_dict(self, request):
        result = {}
        for item in PendingDonor.objects.select_related('bag').all():
            result[item.bag_id] = PendingDonorSerializer(item).data
            result[item.bag_id].pop('bagId', None)
        return Response(result)


class BloodRequestViewSet(viewsets.ModelViewSet):
    queryset = BloodRequest.objects.all()
    serializer_class = BloodRequestSerializer
    lookup_field = 'request_id'
    lookup_url_kwarg = 'pk'
    authentication_classes = [RequireSessionTokenAuthentication]
    permission_classes = [IsAuthenticated, RoleBasedPermission]


class HospitalViewSet(viewsets.ModelViewSet):
    queryset = Hospital.objects.all()
    serializer_class = HospitalSerializer
    lookup_field = 'name'
    authentication_classes = [RequireSessionTokenAuthentication]
    permission_classes = [IsAuthenticated, RoleBasedPermission]


class HospitalDeliveryRecordViewSet(viewsets.ModelViewSet):
    queryset = HospitalDeliveryRecord.objects.all()
    serializer_class = HospitalDeliveryRecordSerializer
    authentication_classes = [RequireSessionTokenAuthentication]
    permission_classes = [IsAuthenticated, RoleBasedPermission]


class DisposalLogViewSet(viewsets.ModelViewSet):
    queryset = DisposalLog.objects.all()
    serializer_class = DisposalLogSerializer
    authentication_classes = [RequireSessionTokenAuthentication]
    permission_classes = [IsAuthenticated, RoleBasedPermission]


class AuditLogViewSet(viewsets.ModelViewSet):
    queryset = AuditLog.objects.select_related('account').all()
    serializer_class = AuditLogSerializer
    authentication_classes = [RequireSessionTokenAuthentication]

    def get_permissions(self):
        action = getattr(self, 'action', None)
        if action in ('list', 'retrieve'):
            return [IsAuthenticated(), IsSuperAdmin()]
        if action == 'create':
            return [IsAuthenticated(), RoleBasedPermission()]
        return [IsAuthenticated(), IsSuperAdmin()]


class NotificationViewSet(viewsets.ModelViewSet):
    queryset = Notification.objects.all()
    serializer_class = NotificationSerializer
    authentication_classes = [RequireSessionTokenAuthentication]
    permission_classes = [IsAuthenticated, RoleBasedPermission]

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
    queryset = Message.objects.all()
    serializer_class = MessageSerializer
    authentication_classes = [RequireSessionTokenAuthentication]
    permission_classes = [IsAuthenticated, RoleBasedPermission]


class StorageRoomViewSet(viewsets.ModelViewSet):
    queryset = StorageRoom.objects.prefetch_related('fridge_set').all()
    serializer_class = StorageRoomSerializer
    lookup_field = 'room'
    authentication_classes = [RequireSessionTokenAuthentication]
    permission_classes = [IsAuthenticated, RoleBasedPermission]


class StorageConfigViewSet(viewsets.ViewSet):
    singleton_pk = 'default'
    authentication_classes = [RequireSessionTokenAuthentication]
    permission_classes = [IsAuthenticated, RoleBasedPermission]

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

        payload = {
            'bloodInventory': blood_inventory,
            'bloodBags': BloodBagSerializer(BloodBag.objects.all(), many=True).data,
            'donors': DonorSerializer(Donor.objects.all(), many=True).data,
            'requests': BloodRequestSerializer(BloodRequest.objects.all(), many=True).data,
            'hospitals': HospitalSerializer(Hospital.objects.all(), many=True).data,
            'hospitalDeliveryRecords': HospitalDeliveryRecordSerializer(
                HospitalDeliveryRecord.objects.all(), many=True
            ).data,
            'disposalLogs': DisposalLogSerializer(DisposalLog.objects.all(), many=True).data,
            'auditLogs': [],
            'notifications': NotificationSerializer(
                notifications_for_account(account),
                many=True,
                context={'request': request},
            ).data,
            'messages': MessageSerializer(Message.objects.all(), many=True).data,
            'storageUnits': StorageRoomSerializer(
                StorageRoom.objects.prefetch_related('fridge_set').all(), many=True
            ).data,
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
            }

        if account and account.role in ('superadmin', 'admin'):
            payload['accounts'] = AccountSerializer(Account.objects.all(), many=True).data

        if account and account.role == 'superadmin':
            payload['auditLogs'] = AuditLogSerializer(
                AuditLog.objects.select_related('account').all(), many=True
            ).data

        return Response(payload)


class AiPredictionsView(SecureAPIView):
    def get(self, request):
        return Response(build_ai_predictions_payload())
