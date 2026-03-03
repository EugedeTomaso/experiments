from django.contrib.auth import get_user_model
from rest_framework import serializers

User = get_user_model()


class RegisterSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(min_length=8, write_only=True)
    user_type = serializers.ChoiceField(
        choices=["writer", "reviewer"], default="writer"
    )
    bio = serializers.CharField(required=False, default="")
    specialties = serializers.ListField(
        child=serializers.CharField(), required=False, default=list
    )

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value.lower()

    def create(self, validated_data):
        user_type = validated_data.pop("user_type", "writer")
        bio = validated_data.pop("bio", "")
        specialties = validated_data.pop("specialties", [])
        user = User.objects.create_user(
            username=validated_data["email"],
            email=validated_data["email"],
            password=validated_data["password"],
            first_name=validated_data["name"],
        )
        from .models import UserProfile
        UserProfile.objects.create(
            user=user, user_type=user_type, bio=bio, specialties=specialties
        )
        return user


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)


class UserSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="first_name")
    user_type = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "name", "email", "user_type"]
        read_only_fields = ["id", "email", "user_type"]

    def get_user_type(self, obj):
        profile = getattr(obj, "profile", None)
        if profile:
            return profile.user_type
        return "writer"


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(min_length=8, write_only=True)
