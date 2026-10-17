from django.shortcuts import render


def community_list(request):
    return render(request, "pages/community.html")


def community_detail(request, id):
    return render(request, "pages/community-detail.html")