from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from . import services
from .auth_utils import account_context_from_request
from .authentication import RequireSessionTokenAuthentication
from .permissions import IsAuthenticatedSession, IsSuperAdmin, RoleBasedPermission


class AuthenticatedOperationView(APIView):
    authentication_classes = [RequireSessionTokenAuthentication]
    permission_classes = [IsAuthenticatedSession, RoleBasedPermission]


class AddDonationView(AuthenticatedOperationView):
    def post(self, request):
        data = request.data
        mode = data.get('mode', 'bag')
        username, role, user_name = account_context_from_request(request, data)
        try:
            if mode == 'bag':
                bags = services.add_donation_bags(
                    blood_type='',
                    qty=int(data.get('qty', 1)),
                    room_name=data.get('room'),
                    fridge_name=data.get('fridge'),
                    shelf_name=data.get('shelf'),
                    product_type=data.get('productType', 'Whole'),
                    username=username,
                    role=role,
                )
                return Response(
                    {'success': True, 'bagIds': [b.bag_id for b in bags]},
                    status=status.HTTP_201_CREATED,
                )
            bags_id = services.add_donation_donor(
                name=data.get('name', '').strip(),
                national_id=data.get('nationalId', '').strip(),
                age=int(data.get('age', 0)),
                phone=data.get('phone', '').strip(),
                address=data.get('address', '').strip(),
                known_blood='',
                room_name=data.get('room'),
                fridge_name=data.get('fridge'),
                product_type=data.get('productType', 'Whole'),
                username=username,
                role=role,
            )
            return Response({'success': True, 'bagId': bags_id}, status=status.HTTP_201_CREATED)
        except (ValueError, TypeError) as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            return Response(
                {'detail': f'تعذر إتمام العملية: {exc}'},
                status=status.HTTP_400_BAD_REQUEST,
            )


class SubmitLabView(AuthenticatedOperationView):
    def post(self, request):
        data = request.data
        username, role, user_name = account_context_from_request(request, data)
        try:
            result = services.submit_lab_result(
                bag_id=data.get('bagId'),
                decision=data.get('decision'),
                final_type=data.get('finalType'),
                reason=data.get('reason', ''),
                user_name=user_name,
                username=username,
                role=role,
                diseases=data.get('diseases', []),
            )
            if not result:
                return Response({'success': True, 'disposed': True})
            if isinstance(result, list):
                return Response({
                    'success': True,
                    'split': True,
                    'bagIds': [b.bag_id for b in result],
                    'bloodType': result[0].blood_type,
                    'status': result[0].status,
                })
            return Response({'success': True, 'bagId': result.bag_id, 'status': result.status})
        except (ValueError, TypeError) as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)


class DisposeBagView(AuthenticatedOperationView):
    def post(self, request):
        data = request.data
        username, role, _user_name = account_context_from_request(request, data)
        try:
            services.dispose_bag(
                bag_id=data.get('bagId', '').strip(),
                disposal_type=data.get('type', 'Whole Blood'),
                blood=data.get('blood', ''),
                reason=data.get('reason', '').strip(),
                worker=data.get('worker', ''),
                username=username,
                role=role,
            )
            return Response({'success': True})
        except (ValueError, TypeError) as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)


class DeliverRequestView(AuthenticatedOperationView):
    def post(self, request):
        data = request.data
        username, role, _user_name = account_context_from_request(request, data)
        try:
            req = services.deliver_request(
                request_id=data.get('requestId'),
                recipient_name=data.get('recipient', '').strip(),
                recipient_phone=data.get('recipientPhone', '').strip(),
                notes=data.get('deliveryNotes', ''),
                delivered_by=data.get('deliveredBy', ''),
                username=username,
                role=role,
            )
            return Response({'success': True, 'requestId': req.request_id})
        except (ValueError, TypeError) as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)


class UpdateRequestStatusView(AuthenticatedOperationView):
    permission_classes = [IsAuthenticatedSession, IsSuperAdmin]

    def post(self, request):
        data = request.data
        username, role, _user_name = account_context_from_request(request, data)
        try:
            req = services.approve_request_status(
                request_id=data.get('requestId'),
                new_status=data.get('status'),
                username=username,
                role=role,
            )
            return Response({'success': True, 'status': req.status})
        except (ValueError, TypeError) as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)


class TransferBagView(AuthenticatedOperationView):
    def post(self, request):
        data = request.data
        username, role, _user_name = account_context_from_request(request, data)
        try:
            bag = services.transfer_bag(
                bag_id=data.get('bagId', '').strip(),
                room_name=data.get('room', '').strip(),
                fridge_name=data.get('fridge', '').strip(),
                shelf_name=(data.get('shelf') or '').strip() or None,
                username=username,
                role=role,
            )
            return Response({'success': True, 'bagId': bag.bag_id, 'location': bag.location})
        except (ValueError, TypeError) as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)


class SaveStorageConfigView(AuthenticatedOperationView):
    def post(self, request):
        data = request.data
        username, role, user_name = account_context_from_request(request, data)
        try:
            config = services.save_storage_config(
                total_rooms=int(data.get('totalRooms', 1)),
                fridges_per_room=int(data.get('totalFridgesPerRoom', 1)),
                shelves_per_fridge=int(data.get('totalShelvesPerFridge', 1)),
                capacity_per_shelf=int(data.get('capacityPerShelf', 100)),
                details=data.get('details'),
            )
            services.push_audit(
                user_name or username,
                role,
                'تحديث تكوين التخزين',
                f'تم تحديث {config.total_rooms} غرفة في نظام التخزين.',
            )
            from .serializers import StorageConfigSerializer

            return Response(StorageConfigSerializer(config).data)
        except (ValueError, TypeError) as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)


class ResetSystemDataView(AuthenticatedOperationView):
    permission_classes = [IsAuthenticatedSession, IsSuperAdmin]

    def post(self, request):
        try:
            services.reset_operational_data()
            return Response({'success': True, 'message': 'تمت مسح جميع بيانات التشغيل بنجاح.'})
        except Exception as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ClearNotificationsView(AuthenticatedOperationView):
    permission_classes = [IsAuthenticatedSession, IsSuperAdmin]

    def post(self, request):
        from .auth_utils import get_request_account

        account = get_request_account(request)
        password = str(request.data.get('password', ''))
        if not services.verify_account_password(account, password):
            return Response({'detail': 'كلمة مرور السوبر أدمن غير صحيحة.'}, status=status.HTTP_403_FORBIDDEN)
        try:
            count = services.clear_all_notifications(account.username, account.get_role_code())
            return Response({'success': True, 'deleted': count})
        except Exception as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ClearAuditLogsView(AuthenticatedOperationView):
    permission_classes = [IsAuthenticatedSession, IsSuperAdmin]

    def post(self, request):
        from .auth_utils import get_request_account

        account = get_request_account(request)
        password = str(request.data.get('password', ''))
        if not services.verify_account_password(account, password):
            return Response({'detail': 'كلمة مرور السوبر أدمن غير صحيحة.'}, status=status.HTTP_403_FORBIDDEN)
        try:
            count = services.clear_all_audit_logs(account.username, account.get_role_code())
            return Response({'success': True, 'deleted': count})
        except Exception as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ClearMessagesView(AuthenticatedOperationView):
    permission_classes = [IsAuthenticatedSession, IsSuperAdmin]

    def post(self, request):
        from .auth_utils import get_request_account

        account = get_request_account(request)
        password = str(request.data.get('password', ''))
        if not services.verify_account_password(account, password):
            return Response({'detail': 'كلمة مرور السوبر أدمن غير صحيحة.'}, status=status.HTTP_403_FORBIDDEN)
        try:
            count = services.clear_all_messages(account.username, account.get_role_code())
            return Response({'success': True, 'deleted': count})
        except Exception as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ClearBloodOutputStatsView(AuthenticatedOperationView):
    permission_classes = [IsAuthenticatedSession, IsSuperAdmin]

    def post(self, request):
        from .auth_utils import get_request_account

        account = get_request_account(request)
        password = str(request.data.get('password', ''))
        if not services.verify_account_password(account, password):
            return Response({'detail': 'كلمة مرور السوبر أدمن غير صحيحة.'}, status=status.HTTP_403_FORBIDDEN)
        try:
            cleared_at = services.clear_blood_output_stats(account.username, account.get_role_code())
            return Response({'success': True, 'clearedAt': cleared_at.isoformat() if cleared_at else None})
        except Exception as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class BackupSystemView(AuthenticatedOperationView):
    permission_classes = [IsAuthenticatedSession, IsSuperAdmin]

    def post(self, request):
        from .auth_utils import get_request_account

        account = get_request_account(request)
        services.push_audit(
            account.username,
            account.role,
            'نسخ احتياطي',
            'طلب نسخ احتياطي — البيانات محفوظة في db.sqlite3 على الخادم.',
        )
        return Response({'success': True, 'message': 'البيانات محفوظة في قاعدة SQLite على الخادم.'})
