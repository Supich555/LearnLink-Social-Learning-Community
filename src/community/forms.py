from django import forms
from .models import Community

class CommunityForm(forms.ModelForm):
    class Meta:
        model = Community
        fields = ['name', 'description', 'is_private']

class JoinByInviteCodeForm(forms.Form):
    invite_code = forms.CharField(
        max_length=8, 
        label="Invite Code",
        widget=forms.TextInput(attrs={'placeholder': 'Enter 8-character invite code'})
    )