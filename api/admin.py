from django.contrib import admin

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
    StorageFridge,
    StorageRoom,
)

admin.site.register(Account)
admin.site.register(BloodInventory)
admin.site.register(Donor)
admin.site.register(BloodBag)
admin.site.register(PendingDonor)
admin.site.register(BloodRequest)
admin.site.register(Hospital)
admin.site.register(HospitalDeliveryRecord)
admin.site.register(DisposalLog)
admin.site.register(AuditLog)
admin.site.register(Notification)
admin.site.register(Message)
admin.site.register(StorageRoom)
admin.site.register(StorageFridge)
admin.site.register(StorageConfig)
