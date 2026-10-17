from django.urls import path
from . import views

urlpatterns = [
    path("", views.community_list, name="community"),
    path("<int:id>/", views.community_detail, name="community_detail"),
]