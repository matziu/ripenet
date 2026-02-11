from .signals import set_audit_user


class AuditMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if hasattr(request, "user") and request.user.is_authenticated:
            set_audit_user(request.user)
        response = self.get_response(request)
        set_audit_user(None)
        return response
