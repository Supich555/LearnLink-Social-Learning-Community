from django.urls import path
from . import views

urlpatterns = [
    path("create/", views.create_post, name="create_post"),
]