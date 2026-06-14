from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .operations_views import (
    AddDonationView,
    DeliverRequestView,
    DisposeBagView,
    ResetSystemDataView,
    SaveStorageConfigView,
    SubmitLabView,
    UpdateRequestStatusView,
)
from .views import (
    AccountViewSet,
    AiPredictionsView,
    AuditLogViewSet,
    BeneficiaryViewSet,
    BloodBagViewSet,
    BloodInventoryViewSet,
    BloodRequestViewSet,
    BootstrapView,
    DashboardStatsView,
    LiveSyncView,
    DisposalLogViewSet,
    DonorViewSet,
    HospitalDeliveryRecordViewSet,
    HospitalViewSet,
    MessageViewSet,
    NotificationViewSet,
    PendingDonorViewSet,
    StorageConfigViewSet,
    StorageRoomViewSet,
    TestAPIView,
    login_view,
)

router = DefaultRouter()
router.register(r'beneficiaries', BeneficiaryViewSet, basename='beneficiary')
router.register(r'accounts', AccountViewSet, basename='account')
router.register(r'blood-inventory', BloodInventoryViewSet, basename='blood-inventory')
router.register(r'blood-bags', BloodBagViewSet, basename='blood-bag')
router.register(r'donors', DonorViewSet, basename='donor')
router.register(r'pending-donors', PendingDonorViewSet, basename='pending-donor')
router.register(r'requests', BloodRequestViewSet, basename='request')
router.register(r'hospitals', HospitalViewSet, basename='hospital')
router.register(
    r'hospital-deliveries',
    HospitalDeliveryRecordViewSet,
    basename='hospital-delivery',
)
router.register(r'disposal-logs', DisposalLogViewSet, basename='disposal-log')
router.register(r'audit-logs', AuditLogViewSet, basename='audit-log')
router.register(r'notifications', NotificationViewSet, basename='notification')
router.register(r'messages', MessageViewSet, basename='message')
router.register(r'storage-units', StorageRoomViewSet, basename='storage-unit')
router.register(r'storage-config', StorageConfigViewSet, basename='storage-config')

urlpatterns = [
    path('test/', TestAPIView.as_view(), name='api-test'),
    path('bootstrap/', BootstrapView.as_view(), name='bootstrap'),
    path('dashboard-stats/', DashboardStatsView.as_view(), name='dashboard-stats'),
    path('live-sync/', LiveSyncView.as_view(), name='live-sync'),
    path('ai-predictions/', AiPredictionsView.as_view(), name='ai-predictions'),
    path('operations/add-donation/', AddDonationView.as_view(), name='op-add-donation'),
    path('operations/submit-lab/', SubmitLabView.as_view(), name='op-submit-lab'),
    path('operations/dispose/', DisposeBagView.as_view(), name='op-dispose'),
    path('operations/deliver-request/', DeliverRequestView.as_view(), name='op-deliver-request'),
    path('operations/update-request-status/', UpdateRequestStatusView.as_view(), name='op-request-status'),
    path('operations/save-storage-config/', SaveStorageConfigView.as_view(), name='op-storage-config'),
    path('operations/reset-data/', ResetSystemDataView.as_view(), name='op-reset-data'),
    path('accounts/login/', login_view, name='accounts-login'),
    path('', include(router.urls)),
]
