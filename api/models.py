from django.db import models

AI_PENDING_REQUEST_STATUSES = (
    'Pending Approval',
    'Ready for Delivery',
    'Pending',
    'In-Progress',
)


class Account(models.Model):
    ROLE_CHOICES = [
        ('superadmin', 'Super Admin'),
        ('admin', 'Admin'),
        ('deputy', 'Deputy'),
        ('lab', 'Lab'),
    ]
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('inactive', 'Inactive'),
    ]

    username = models.CharField(max_length=150, primary_key=True)
    name = models.CharField(max_length=255)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    email = models.EmailField()
    password = models.CharField(max_length=128)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')

    class Meta:
        verbose_name = 'Account'
        verbose_name_plural = 'Accounts'

    def __str__(self):
        return self.username


class BloodInventory(models.Model):
    blood_type = models.CharField(max_length=5, primary_key=True)
    available = models.IntegerField(default=0)
    reserved = models.IntegerField(default=0)
    issued = models.IntegerField(default=0)
    expired = models.IntegerField(default=0)
    critical_limit = models.IntegerField(default=0)

    class Meta:
        verbose_name_plural = 'Blood inventory'

    def __str__(self):
        return self.blood_type

    @classmethod
    def aggregate_totals(cls):
        totals = {'available': 0, 'reserved': 0, 'issued': 0, 'expired': 0, 'total_units': 0}
        for item in cls.objects.all():
            totals['available'] += item.available
            totals['reserved'] += item.reserved
            totals['issued'] += item.issued
            totals['expired'] += item.expired
            totals['total_units'] += item.available + item.reserved + item.issued + item.expired
        return totals


class Donor(models.Model):
    donor_id = models.CharField(max_length=20, primary_key=True, db_column='id')
    name = models.CharField(max_length=255)
    national_id = models.CharField(max_length=20, blank=True, default='', db_index=True)
    blood = models.CharField(max_length=5)
    phone = models.CharField(max_length=20, blank=True, default='', db_index=True)
    age = models.IntegerField(default=0)
    address = models.CharField(max_length=255, blank=True, default='')
    status = models.CharField(max_length=20, default='Active')
    total_count = models.IntegerField(default=0)
    last_date = models.DateField(null=True, blank=True)

    class Meta:
        db_table = 'api_donor'

    def __str__(self):
        return self.donor_id


class BloodBag(models.Model):
    bag_id = models.CharField(max_length=20, primary_key=True, db_column='id')
    donor = models.CharField(max_length=255)
    blood_type = models.CharField(max_length=10)
    qty = models.IntegerField(default=1)
    date = models.DateField()
    expiry = models.DateField(db_index=True)
    location = models.CharField(max_length=255)
    status = models.CharField(max_length=50, db_index=True)

    class Meta:
        db_table = 'api_bloodbag'

    def __str__(self):
        return self.bag_id


class PendingDonor(models.Model):
    bag = models.OneToOneField(
        BloodBag,
        on_delete=models.CASCADE,
        primary_key=True,
        related_name='pending_donor',
    )
    name = models.CharField(max_length=255)
    national_id = models.CharField(max_length=20)
    age = models.IntegerField(default=0)
    phone = models.CharField(max_length=20, blank=True, default='')
    address = models.CharField(max_length=255, blank=True, default='')
    room = models.CharField(max_length=50)
    fridge = models.CharField(max_length=50)

    def __str__(self):
        return f'Pending {self.bag.bag_id}'


class BloodRequest(models.Model):
    request_id = models.CharField(max_length=20, primary_key=True, db_column='id')
    hospital = models.CharField(max_length=255)
    blood = models.CharField(max_length=5)
    qty = models.IntegerField(default=1)
    priority = models.CharField(max_length=20)
    status = models.CharField(max_length=50)

    class Meta:
        db_table = 'api_bloodrequest'

    def __str__(self):
        return self.request_id

    @classmethod
    def pending_requests(cls):
        return cls.objects.filter(status__in=AI_PENDING_REQUEST_STATUSES)


class Hospital(models.Model):
    name = models.CharField(max_length=255, unique=True)
    address = models.CharField(max_length=255)
    manager = models.CharField(max_length=255)
    phone = models.CharField(max_length=50)
    status = models.CharField(max_length=50, default='Connected')

    def __str__(self):
        return self.name


class HospitalDeliveryRecord(models.Model):
    record_id = models.CharField(max_length=20)
    hospital = models.CharField(max_length=255)
    blood = models.CharField(max_length=5)
    qty = models.IntegerField(default=1)
    priority = models.CharField(max_length=20)
    recipient = models.CharField(max_length=255)
    recipient_phone = models.CharField(max_length=20)
    delivery_notes = models.CharField(max_length=500, blank=True, default='')
    delivered_by = models.CharField(max_length=255)
    delivered_at = models.DateField()

    class Meta:
        ordering = ['-delivered_at', '-pk']

    def __str__(self):
        return self.record_id


class DisposalLog(models.Model):
    bag_code = models.CharField(max_length=20)
    disposal_type = models.CharField(max_length=100, db_column='type')
    blood = models.CharField(max_length=5)
    date = models.DateField()
    reason = models.TextField()
    worker = models.CharField(max_length=255)

    class Meta:
        ordering = ['-date', '-pk']

    def __str__(self):
        return self.bag_code


class AuditLog(models.Model):
    account = models.ForeignKey(
        Account,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='audit_entries',
    )
    time = models.CharField(max_length=32)
    user = models.CharField(max_length=150)
    role = models.CharField(max_length=50)
    action = models.CharField(max_length=255)
    details = models.TextField()

    class Meta:
        ordering = ['-pk']

    def __str__(self):
        return f'{self.user} - {self.action}'


class Notification(models.Model):
    title = models.CharField(max_length=255)
    notification_type = models.CharField(max_length=20, db_column='type')
    time = models.CharField(max_length=20)
    message = models.TextField()
    read = models.BooleanField(default=False)
    read_by = models.JSONField(default=list)
    deleted_by = models.JSONField(default=list)

    class Meta:
        ordering = ['-pk']

    def __str__(self):
        return self.title


class Message(models.Model):
    sender = models.ForeignKey(
        Account,
        on_delete=models.CASCADE,
        related_name='sent_messages',
        null=True,
        blank=True,
    )
    time = models.CharField(max_length=20)
    text = models.TextField()
    seen_by = models.JSONField(default=list)

    class Meta:
        ordering = ['-pk']

    def __str__(self):
        return self.sender.name if self.sender else self.text[:50]


class StorageRoom(models.Model):
    room = models.CharField(max_length=50, primary_key=True)
    used = models.IntegerField(default=0)
    capacity = models.IntegerField(default=100)

    def __str__(self):
        return self.room


class StorageFridge(models.Model):
    room = models.ForeignKey(StorageRoom, on_delete=models.CASCADE, related_name='fridge_set')
    fridge_id = models.CharField(max_length=50)
    used = models.IntegerField(default=0)

    class Meta:
        unique_together = [('room', 'fridge_id')]

    def __str__(self):
        return f'{self.room_id} / {self.fridge_id}'


class StorageConfig(models.Model):
    singleton_key = models.CharField(max_length=20, primary_key=True, default='default')
    total_rooms = models.IntegerField(default=3)
    total_fridges_per_room = models.IntegerField(default=2)
    total_shelves_per_fridge = models.IntegerField(default=4)
    capacity_per_shelf = models.IntegerField(default=100)
    room_names = models.JSONField(default=list)
    details = models.JSONField(default=list)

    def __str__(self):
        return 'Storage configuration'


class Beneficiary(models.Model):
    name = models.CharField(max_length=255, verbose_name='الاسم')
    phone = models.CharField(max_length=20, verbose_name='رقم الهاتف')
    national_id = models.CharField(max_length=20, verbose_name='رقم البطاقة')
    blood_type_received = models.CharField(max_length=5, verbose_name='نوع الفصيلة المستهلكة')
    bags_consumed = models.IntegerField(default=1, verbose_name='عدد الأكياس المستهلكة')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        verbose_name = 'Beneficiary'
        verbose_name_plural = 'Beneficiaries'
        ordering = ['-created_at', '-pk']

    def __str__(self):
        return self.name


# Inventory restoration when a beneficiary record is deleted
from django.db.models.signals import post_delete
from django.dispatch import receiver


@receiver(post_delete, sender=Beneficiary)
def restore_inventory_on_beneficiary_delete(sender, instance, **kwargs):
    try:
        inv = BloodInventory.objects.filter(blood_type=instance.blood_type_received).first()
        if inv:
            inv.available = inv.available + (instance.bags_consumed or 0)
            inv.issued = max(0, inv.issued - (instance.bags_consumed or 0))
            inv.save()
    except Exception:
        # swallow exceptions to avoid breaking delete flow; logging could be added
        pass


@receiver(post_delete, sender=BloodBag)
def restore_inventory_on_bloodbag_delete(sender, instance, **kwargs):
    """عند حذف كيس معتمد (Approved)، استعد الكيس إلى المخزون.
    - إذا كان الكيس في حالة Approved: يعود إلى available
    - إذا كان في حالة أخرى (Pending/Failed/etc): لا تأثير
    """
    try:
        # فقط استعد الأكياس المعتمدة (Approved)
        if instance.status == 'Approved':
            inv = BloodInventory.objects.filter(blood_type=instance.blood_type).first()
            if inv:
                inv.available = inv.available + instance.qty
                inv.issued = max(0, inv.issued - instance.qty)
                inv.save()
    except Exception:
        pass

