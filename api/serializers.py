from rest_framework import serializers
from django.db import transaction

from .auth_backend import ensure_django_user_for_account, set_account_password
from .auth_utils import get_request_account
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
    StorageFridge,
    StorageRoom,
)


class AccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = Account
        fields = ['username', 'name', 'role', 'email', 'password', 'status']
        extra_kwargs = {
            'password': {
                'write_only': True,
                'required': False,
                'trim_whitespace': False,
            }
        }

    def to_representation(self, instance):
        return {
            'username': instance.username,
            'name': instance.name,
            'role': instance.role,
            'email': instance.email,
            'status': instance.status,
        }

    def validate_username(self, value):
        return str(value).strip().lower()

    def validate(self, attrs):
        request = self.context.get('request')
        from .auth_utils import get_request_account

        actor = get_request_account(request) if request else None
        if self.instance is None and not (actor and actor.role == 'superadmin'):
            attrs['role'] = 'lab'
            attrs['status'] = 'active'
        elif self.instance is None and attrs.get('role') == 'superadmin' and actor.role != 'superadmin':
            raise serializers.ValidationError({'role': 'لا يمكن إنشاء حساب مدير عام بهذه الطريقة.'})
        return attrs

    def validate_password(self, value):
        if value is None:
            return value
        if len(str(value)) < 4:
            raise serializers.ValidationError('كلمة المرور يجب أن تكون 4 أحرف على الأقل.')
        return value

    def create(self, validated_data):
        password = validated_data.pop('password', None)
        if not password:
            raise serializers.ValidationError({'password': 'كلمة المرور مطلوبة.'})
        from django.contrib.auth.hashers import make_password

        validated_data['password'] = make_password(password)
        account = super().create(validated_data)
        ensure_django_user_for_account(account, password)
        return account

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        account = super().update(instance, validated_data)
        if password:
            set_account_password(account, password)
        return account


class AccountLoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(allow_blank=False, trim_whitespace=False)

    def validate_username(self, value):
        return str(value).strip().lower()

    def validate_password(self, value):
        return str(value).replace('\u200b', '').replace('\u200c', '').replace('\u200d', '').replace('\ufeff', '')


class AccountPublicSerializer(serializers.ModelSerializer):
    is_superuser = serializers.SerializerMethodField()

    class Meta:
        model = Account
        fields = ['username', 'name', 'role', 'email', 'is_superuser']

    def get_is_superuser(self, obj):
        return obj.role == 'superadmin'


class ProfileUpdateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=False,
        trim_whitespace=False,
    )

    class Meta:
        model = Account
        fields = ['name', 'email', 'password']

    def validate_password(self, value):
        if value is None:
            return value
        if len(str(value)) < 4:
            raise serializers.ValidationError('كلمة المرور يجب أن تكون 4 أحرف على الأقل.')
        return value

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        account = super().update(instance, validated_data)
        if password:
            set_account_password(account, password)
        return account


class BloodInventorySerializer(serializers.ModelSerializer):
    class Meta:
        model = BloodInventory
        fields = ['blood_type', 'available', 'reserved', 'issued', 'expired', 'critical_limit']

    def to_representation(self, instance):
        return {
            'bloodType': instance.blood_type,
            'available': instance.available,
            'reserved': instance.reserved,
            'issued': instance.issued,
            'expired': instance.expired,
            'criticalLimit': instance.critical_limit,
        }

    def to_internal_value(self, data):
        mapped = {
            'blood_type': data.get('bloodType', data.get('blood_type')),
            'available': data.get('available'),
            'reserved': data.get('reserved'),
            'issued': data.get('issued'),
            'expired': data.get('expired'),
            'critical_limit': data.get('criticalLimit', data.get('critical_limit')),
        }
        return super().to_internal_value(mapped)

    def create(self, validated_data):
        blood_type = validated_data.pop('blood_type', None)
        if blood_type is None:
            blood_type = self.initial_data.get('bloodType')
        validated_data['blood_type'] = blood_type
        return super().create(validated_data)

    def update(self, instance, validated_data):
        if 'blood_type' not in validated_data:
            blood_type = self.initial_data.get('bloodType')
            if blood_type:
                validated_data['blood_type'] = blood_type
        return super().update(instance, validated_data)


class DonorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Donor
        fields = [
            'donor_id',
            'name',
            'national_id',
            'blood',
            'phone',
            'age',
            'address',
            'status',
            'total_count',
            'last_date',
        ]

    def to_representation(self, instance):
        return {
            'id': instance.donor_id,
            'name': instance.name,
            'nationalId': instance.national_id,
            'blood': instance.blood,
            'phone': instance.phone,
            'age': instance.age,
            'address': instance.address,
            'status': instance.status,
            'totalCount': instance.total_count,
            'lastDate': instance.last_date.isoformat() if instance.last_date else None,
        }

    def to_internal_value(self, data):
        mapped = {
            'donor_id': data.get('id', data.get('donor_id')),
            'name': data.get('name'),
            'national_id': data.get('nationalId', data.get('national_id', '')),
            'blood': data.get('blood'),
            'phone': data.get('phone', ''),
            'age': data.get('age', 0),
            'address': data.get('address', ''),
            'status': data.get('status', 'Active'),
            'total_count': data.get('totalCount', data.get('total_count', 0)),
            'last_date': data.get('lastDate', data.get('last_date')),
        }
        return super().to_internal_value(mapped)

    def create(self, validated_data):
        donor_id = validated_data.get('donor_id') or self.initial_data.get('id')
        validated_data['donor_id'] = donor_id
        return super().create(validated_data)


class BloodBagSerializer(serializers.ModelSerializer):
    class Meta:
        model = BloodBag
        fields = [
            'bag_id',
            'donor',
            'blood_type',
            'qty',
            'date',
            'expiry',
            'location',
            'status',
        ]

    def to_representation(self, instance):
        return {
            'id': instance.bag_id,
            'donor': instance.donor,
            'bloodType': instance.blood_type,
            'qty': instance.qty,
            'date': instance.date.isoformat(),
            'expiry': instance.expiry.isoformat(),
            'location': instance.location,
            'status': instance.status,
        }

    def to_internal_value(self, data):
        mapped = {
            'bag_id': data.get('id', data.get('bag_id')),
            'donor': data.get('donor'),
            'blood_type': data.get('bloodType', data.get('blood_type')),
            'qty': data.get('qty', 1),
            'date': data.get('date'),
            'expiry': data.get('expiry'),
            'location': data.get('location'),
            'status': data.get('status'),
        }
        return super().to_internal_value(mapped)

    def create(self, validated_data):
        bag_id = validated_data.get('bag_id') or self.initial_data.get('id')
        validated_data['bag_id'] = bag_id
        return super().create(validated_data)


class PendingDonorSerializer(serializers.ModelSerializer):
    bagId = serializers.CharField(source='bag_id', read_only=True)

    class Meta:
        model = PendingDonor
        fields = [
            'bag',
            'name',
            'national_id',
            'age',
            'phone',
            'address',
            'room',
            'fridge',
            'bagId',
        ]

    def to_representation(self, instance):
        return {
            'bagId': instance.bag_id,
            'name': instance.name,
            'nationalId': instance.national_id,
            'age': instance.age,
            'phone': instance.phone,
            'address': instance.address,
            'room': instance.room,
            'fridge': instance.fridge,
        }

    def to_internal_value(self, data):
        bag_id = data.get('bagId', data.get('bag_id', data.get('bag')))
        mapped = {
            'bag': bag_id,
            'name': data.get('name'),
            'national_id': data.get('nationalId', data.get('national_id')),
            'age': data.get('age', 0),
            'phone': data.get('phone', ''),
            'address': data.get('address', ''),
            'room': data.get('room'),
            'fridge': data.get('fridge'),
        }
        return super().to_internal_value(mapped)


class BloodRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = BloodRequest
        fields = ['request_id', 'hospital', 'blood', 'qty', 'priority', 'status']

    def to_representation(self, instance):
        return {
            'id': instance.request_id,
            'hospital': instance.hospital,
            'blood': instance.blood,
            'qty': instance.qty,
            'priority': instance.priority,
            'status': instance.status,
        }

    def to_internal_value(self, data):
        mapped = {
            'request_id': data.get('id', data.get('request_id')),
            'hospital': data.get('hospital'),
            'blood': data.get('blood'),
            'qty': data.get('qty', 1),
            'priority': data.get('priority'),
            'status': data.get('status'),
        }
        return super().to_internal_value(mapped)

    def create(self, validated_data):
        request_id = validated_data.get('request_id') or self.initial_data.get('id')
        validated_data['request_id'] = request_id
        return super().create(validated_data)


class HospitalSerializer(serializers.ModelSerializer):
    class Meta:
        model = Hospital
        fields = ['id', 'name', 'address', 'manager', 'phone', 'status']
        read_only_fields = ['id']

    def to_representation(self, instance):
        return {
            'name': instance.name,
            'address': instance.address,
            'manager': instance.manager,
            'phone': instance.phone,
            'status': instance.status,
        }


class HospitalDeliveryRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = HospitalDeliveryRecord
        fields = [
            'record_id',
            'hospital',
            'blood',
            'qty',
            'priority',
            'recipient',
            'recipient_phone',
            'delivery_notes',
            'delivered_by',
            'delivered_at',
        ]

    def to_representation(self, instance):
        return {
            'id': instance.record_id,
            'hospital': instance.hospital,
            'blood': instance.blood,
            'qty': instance.qty,
            'priority': instance.priority,
            'recipient': instance.recipient,
            'recipientPhone': instance.recipient_phone,
            'deliveryNotes': instance.delivery_notes,
            'deliveredBy': instance.delivered_by,
            'deliveredAt': instance.delivered_at.isoformat(),
        }

    def to_internal_value(self, data):
        mapped = {
            'record_id': data.get('id', data.get('record_id')),
            'hospital': data.get('hospital'),
            'blood': data.get('blood'),
            'qty': data.get('qty', 1),
            'priority': data.get('priority'),
            'recipient': data.get('recipient'),
            'recipient_phone': data.get('recipientPhone', data.get('recipient_phone')),
            'delivery_notes': data.get('deliveryNotes', data.get('delivery_notes', '')),
            'delivered_by': data.get('deliveredBy', data.get('delivered_by')),
            'delivered_at': data.get('deliveredAt', data.get('delivered_at')),
        }
        return super().to_internal_value(mapped)

    def create(self, validated_data):
        record_id = validated_data.get('record_id') or self.initial_data.get('id')
        validated_data['record_id'] = record_id
        return super().create(validated_data)


class DisposalLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = DisposalLog
        fields = ['bag_code', 'disposal_type', 'blood', 'date', 'reason', 'worker']

    def to_representation(self, instance):
        return {
            'dbId': instance.pk,
            'id': instance.bag_code,
            'type': instance.disposal_type,
            'blood': instance.blood,
            'date': instance.date.isoformat(),
            'reason': instance.reason,
            'worker': instance.worker,
        }

    def to_internal_value(self, data):
        mapped = {
            'bag_code': data.get('id', data.get('bag_code')),
            'disposal_type': data.get('type', data.get('disposal_type')),
            'blood': data.get('blood'),
            'date': data.get('date'),
            'reason': data.get('reason'),
            'worker': data.get('worker'),
        }
        return super().to_internal_value(mapped)

    def create(self, validated_data):
        bag_code = validated_data.get('bag_code') or self.initial_data.get('id')
        validated_data['bag_code'] = bag_code
        return super().create(validated_data)


class AuditLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditLog
        fields = ['id', 'time', 'user', 'role', 'action', 'details']

    def to_representation(self, instance):
        display_user = instance.user
        if instance.account and instance.account.name:
            display_user = instance.account.name
        return {
            'id': instance.pk,
            'time': instance.time,
            'user': display_user,
            'role': instance.role,
            'action': instance.action,
            'details': instance.details,
        }

    def create(self, validated_data):
        username = str(validated_data.get('user', '')).strip().lower()
        account = Account.objects.filter(username=username).first()
        if account:
            validated_data['account'] = account
            validated_data['user'] = account.name
            validated_data['role'] = account.role
        return super().create(validated_data)


class BeneficiarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Beneficiary
        fields = [
            'id',
            'name',
            'phone',
            'national_id',
            'blood_type_received',
            'bags_consumed',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']

    def to_representation(self, instance):
        return {
            'id': instance.pk,
            'name': instance.name,
            'phone': instance.phone,
            'nationalId': instance.national_id,
            'bloodTypeReceived': instance.blood_type_received,
            'bagsConsumed': instance.bags_consumed,
            'createdAt': instance.created_at.isoformat() if instance.created_at else None,
        }

    def to_internal_value(self, data):
        mapped = {
            'name': data.get('name'),
            'phone': data.get('phone'),
            'national_id': data.get('nationalId', data.get('national_id')),
            'blood_type_received': data.get(
                'bloodTypeReceived', data.get('blood_type_received')
            ),
            'bags_consumed': data.get('bagsConsumed', data.get('bags_consumed', 1)),
        }
        return super().to_internal_value(mapped)

    def validate_bags_consumed(self, value):
        qty = int(value or 0)
        if qty < 1:
            raise serializers.ValidationError('عدد الأكياس يجب أن يكون 1 على الأقل.')
        return qty

    def create(self, validated_data):
        blood_type = validated_data.get('blood_type_received')
        qty = int(validated_data.get('bags_consumed', 1) or 0)
        from .models import BloodInventory

        with transaction.atomic():
            inv = BloodInventory.objects.select_for_update().filter(blood_type=blood_type).first()
            if not inv:
                raise serializers.ValidationError({'bloodTypeReceived': 'فصيلة الدم غير موجودة في المخزون.'})
            if inv.available < qty:
                raise serializers.ValidationError({'bagsConsumed': 'عجز في المخزون لعدد الأكياس المطلوبة.'})
            inv.available = inv.available - qty
            inv.issued = inv.issued + qty
            inv.save()
            return super().create(validated_data)

    def update(self, instance, validated_data):
        old_blood = instance.blood_type_received
        old_qty = int(instance.bags_consumed or 0)
        new_blood = validated_data.get('blood_type_received', old_blood)
        new_qty = int(validated_data.get('bags_consumed', old_qty) or 0)
        from .models import BloodInventory

        with transaction.atomic():
            # same blood type, adjust by delta
            if old_blood == new_blood:
                delta = new_qty - old_qty
                if delta > 0:
                    inv = BloodInventory.objects.select_for_update().filter(blood_type=new_blood).first()
                    if not inv:
                        raise serializers.ValidationError({'bloodTypeReceived': 'فصيلة الدم غير موجودة في المخزون.'})
                    if inv.available < delta:
                        raise serializers.ValidationError({'bagsConsumed': 'عجز في المخزون لعدد الأكياس المطلوبة.'})
                    inv.available -= delta
                    inv.issued += delta
                    inv.save()
                elif delta < 0:
                    inv = BloodInventory.objects.select_for_update().filter(blood_type=new_blood).first()
                    if inv:
                        inv.available += (-delta)
                        inv.issued = max(0, inv.issued - (-delta))
                        inv.save()
            else:
                # restore old blood inventory
                inv_old = BloodInventory.objects.select_for_update().filter(blood_type=old_blood).first()
                if inv_old:
                    inv_old.available += old_qty
                    inv_old.issued = max(0, inv_old.issued - old_qty)
                    inv_old.save()
                # deduct from new blood inventory
                inv_new = BloodInventory.objects.select_for_update().filter(blood_type=new_blood).first()
                if not inv_new:
                    raise serializers.ValidationError({'bloodTypeReceived': 'فصيلة الدم الجديدة غير موجودة في المخزون.'})
                if inv_new.available < new_qty:
                    raise serializers.ValidationError({'bagsConsumed': 'عجز في المخزون للفصيلة الجديدة.'})
                inv_new.available -= new_qty
                inv_new.issued += new_qty
                inv_new.save()

            return super().update(instance, validated_data)


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ['title', 'notification_type', 'time', 'message', 'read_by', 'deleted_by', 'read']

    def _account_username(self):
        request = self.context.get('request')
        if not request:
            return ''
        account = get_request_account(request)
        return account.username if account else ''

    def to_representation(self, instance):
        username = self._account_username()
        read_by = instance.read_by or []
        is_read = username in read_by if username else bool(instance.read)
        return {
            'id': instance.pk,
            'title': instance.title,
            'type': instance.notification_type,
            'time': instance.time,
            'message': instance.message,
            'read': is_read,
        }

    def to_internal_value(self, data):
        mapped = {
            'title': data.get('title'),
            'notification_type': data.get('type', data.get('notification_type')),
            'time': data.get('time'),
            'message': data.get('message'),
            'read': data.get('read', False),
        }
        return super().to_internal_value(mapped)


class MessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.SerializerMethodField()
    seen_by_names = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = ['id', 'sender_name', 'sender', 'time', 'text', 'seen_by', 'seen_by_names']
        extra_kwargs = {
            'sender': {'write_only': True, 'required': False},
            'seen_by': {'required': False},
        }

    def get_sender_name(self, instance):
        sender = instance.sender
        if not sender:
            return 'Unknown'
        name = str(sender.name or '').strip()
        if name:
            return name
        return sender.username

    def get_seen_by_names(self, instance):
        seen_by = instance.seen_by or []
        if not seen_by:
            return []

        accounts = list(Account.objects.all())
        username_to_name = {
            acc.username.lower(): (acc.name or acc.username).strip()
            for acc in accounts
        }
        registered_names = {
            (acc.name or '').strip()
            for acc in accounts
            if (acc.name or '').strip()
        }

        resolved = []
        seen = set()
        for raw in seen_by:
            token = str(raw or '').strip()
            if not token:
                continue
            display = username_to_name.get(token.lower())
            if not display and token in registered_names:
                display = token
            if not display:
                display = token
            if display not in seen:
                seen.add(display)
                resolved.append(display)
        return resolved

    def create(self, validated_data):
        request = self.context.get('request')
        if request:
            account = get_request_account(request)
            if account:
                validated_data['sender'] = account
        return super().create(validated_data)

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        representation.pop('sender', None)
        if 'seen_by' in representation:
            representation['seenBy'] = representation.pop('seen_by')
        if 'seen_by_names' in representation:
            representation['seenByNames'] = representation.pop('seen_by_names')
        return representation

    def to_internal_value(self, data):
        mapped = {
            'time': data.get('time'),
            'text': data.get('text'),
            'seen_by': data.get('seenBy', data.get('seen_by', [])),
        }
        return super().to_internal_value(mapped)


class StorageFridgeSerializer(serializers.ModelSerializer):
    class Meta:
        model = StorageFridge
        fields = ['fridge_id', 'used']

    def to_representation(self, instance):
        return {
            'id': instance.fridge_id,
            'used': instance.used,
        }

    def to_internal_value(self, data):
        mapped = {
            'fridge_id': data.get('id', data.get('fridge_id')),
            'used': data.get('used', 0),
        }
        return super().to_internal_value(mapped)


class StorageRoomSerializer(serializers.ModelSerializer):
    fridges = StorageFridgeSerializer(many=True, source='fridge_set', read_only=True)

    class Meta:
        model = StorageRoom
        fields = ['room', 'used', 'capacity', 'fridges']

    def to_representation(self, instance):
        fridges = [
            {'id': fridge.fridge_id, 'used': fridge.used}
            for fridge in instance.fridge_set.all()
        ]
        return {
            'room': instance.room,
            'used': instance.used,
            'capacity': instance.capacity,
            'fridges': fridges,
        }

    def create(self, validated_data):
        fridges_data = self.initial_data.get('fridges', [])
        room = StorageRoom.objects.create(**validated_data)
        for fridge_data in fridges_data:
            StorageFridge.objects.create(
                room=room,
                fridge_id=fridge_data.get('id', fridge_data.get('fridge_id')),
                used=fridge_data.get('used', 0),
            )
        return room

    def update(self, instance, validated_data):
        fridges_data = self.initial_data.get('fridges')
        instance = super().update(instance, validated_data)
        if fridges_data is not None:
            instance.fridge_set.all().delete()
            for fridge_data in fridges_data:
                StorageFridge.objects.create(
                    room=instance,
                    fridge_id=fridge_data.get('id', fridge_data.get('fridge_id')),
                    used=fridge_data.get('used', 0),
                )
        return instance


class StorageConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = StorageConfig
        fields = [
            'total_rooms',
            'total_fridges_per_room',
            'total_shelves_per_fridge',
            'capacity_per_shelf',
            'room_names',
            'details',
        ]

    def to_representation(self, instance):
        return {
            'totalRooms': instance.total_rooms,
            'totalFridgesPerRoom': instance.total_fridges_per_room,
            'totalShelvesPerFridge': instance.total_shelves_per_fridge,
            'capacityPerShelf': instance.capacity_per_shelf,
            'roomNames': instance.room_names,
            'details': instance.details,
        }

    def to_internal_value(self, data):
        mapped = {
            'total_rooms': data.get('totalRooms', data.get('total_rooms')),
            'total_fridges_per_room': data.get(
                'totalFridgesPerRoom', data.get('total_fridges_per_room')
            ),
            'total_shelves_per_fridge': data.get(
                'totalShelvesPerFridge', data.get('total_shelves_per_fridge')
            ),
            'capacity_per_shelf': data.get(
                'capacityPerShelf', data.get('capacity_per_shelf')
            ),
            'room_names': data.get('roomNames', data.get('room_names', [])),
            'details': data.get('details', []),
        }
        return super().to_internal_value(mapped)

