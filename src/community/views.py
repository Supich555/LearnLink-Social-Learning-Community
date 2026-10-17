from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.shortcuts import get_object_or_404, redirect
from django.utils.http import url_has_allowed_host_and_scheme
from django.views.decorators.http import require_POST

from .models import Community, CommunityMember


def community_list(request):
    return redirect("/#communities-page")


def community_detail(request, id):
    community = get_object_or_404(Community, pk=id)
    return redirect(f"/#community-{community.pk}")


def _redirect_to(request, fallback="/#communities-page"):
    destination = request.POST.get("next", fallback)
    if not url_has_allowed_host_and_scheme(
        destination,
        allowed_hosts={request.get_host()},
        require_https=request.is_secure(),
    ):
        destination = fallback
    return redirect(destination)


@login_required
@require_POST
def create_community(request):
    name = request.POST.get("name", "").strip()
    description = request.POST.get("description", "").strip()
    if not name or len(name) > 100:
        messages.error(request, "กรุณากรอกชื่อชุมชนไม่เกิน 100 ตัวอักษร")
        return _redirect_to(request, "/#community-create")

    # สร้าง Community โดยยังไม่ต้องสร้าง code เอง
    community = Community.objects.create(
        name=name,
        description=description or "พื้นที่สำหรับแบ่งปันและเรียนรู้ไปด้วยกัน",
        is_private=request.POST.get("is_private") == "true",
        owner=request.user,
    )
    
    # Encapsulation: เรียกใช้ Helper Method จาก Model เพื่อสร้าง Invite Code
    code = community.generate_invite_code()
    
    CommunityMember.objects.get_or_create(community=community, user=request.user)
    messages.success(request, f"สร้างชุมชน {community.name} แล้ว · รหัสเชิญ {code}")
    return _redirect_to(request, f"/#community-{community.pk}")


@login_required
@require_POST
def join_community(request, community_id):
    community = get_object_or_404(Community, pk=community_id)
    if community.is_private and request.POST.get("invite_code", "").strip().upper() != community.invite_code:
        messages.error(request, "รหัสเชิญไม่ถูกต้อง")
        return _redirect_to(request, f"/#community-{community.pk}")
    CommunityMember.objects.get_or_create(community=community, user=request.user)
    messages.success(request, f"เข้าร่วมชุมชน {community.name} แล้ว")
    return _redirect_to(request, f"/#community-{community.pk}")


@login_required
@require_POST
def join_community_by_code(request):
    code = request.POST.get("invite_code", "").strip().upper()
    community = Community.objects.filter(invite_code=code).first()
    if community is None:
        messages.error(request, "ไม่พบชุมชนจากรหัสเชิญนี้")
        return _redirect_to(request)
    CommunityMember.objects.get_or_create(community=community, user=request.user)
    messages.success(request, f"เข้าร่วมชุมชน {community.name} แล้ว")
    return _redirect_to(request, f"/#community-{community.pk}")


@login_required
@require_POST
def leave_community(request, community_id):
    community = get_object_or_404(Community, id=community_id)
    if community.owner_id == request.user.pk:
        messages.error(request, "เจ้าของชุมชนไม่สามารถออกจากชุมชนได้")
    else:
        CommunityMember.objects.filter(community=community, user=request.user).delete()
        messages.success(request, f"ออกจากชุมชน {community.name} แล้ว")
    return _redirect_to(request)