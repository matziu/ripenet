from rest_framework import serializers

from .models import Project, Site


class SiteSerializer(serializers.ModelSerializer):
    vlan_count = serializers.IntegerField(read_only=True, default=0)
    host_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Site
        fields = [
            "id", "project", "name", "address", "supernet", "latitude", "longitude",
            "vlan_count", "host_count", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "project", "created_at", "updated_at"]


class ProjectSerializer(serializers.ModelSerializer):
    site_count = serializers.IntegerField(read_only=True, default=0)
    created_by_username = serializers.CharField(source="created_by.username", read_only=True, default=None)

    class Meta:
        model = Project
        fields = [
            "id", "name", "description", "status", "supernet",
            "created_by", "created_by_username", "site_count",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_by", "created_at", "updated_at"]

    def create(self, validated_data):
        validated_data["created_by"] = self.context["request"].user
        return super().create(validated_data)


class ProjectListSerializer(serializers.ModelSerializer):
    site_count = serializers.IntegerField(read_only=True, default=0)
    created_by_username = serializers.CharField(source="created_by.username", read_only=True, default=None)

    class Meta:
        model = Project
        fields = [
            "id", "name", "description", "status", "supernet",
            "created_by_username", "site_count", "created_at",
        ]
