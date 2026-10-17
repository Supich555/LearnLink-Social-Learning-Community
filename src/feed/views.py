from django.shortcuts import render

from post.models import Post


def home_view(request):
    posts = Post.objects.select_related("user", "community").prefetch_related(
        "comment_set__user",
        "like_set",
    ).order_by("-created_at")
    profile_posts = posts.filter(user=request.user) if request.user.is_authenticated else []
    return render(
        request,
        "home/home.html",
        {
            "posts": posts,
            "profile_posts": profile_posts,
        },
    )

def explore_view(request):
    return render(request, "้home/explore.html")