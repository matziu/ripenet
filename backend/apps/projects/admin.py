from django.contrib import admin

from .models import Project, Site


class SiteInline(admin.TabularInline):
    model = Site
    extra = 1


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ("name", "supernet", "created_by", "created_at")
    list_filter = ()
    search_fields = ("name", "description")
    inlines = [SiteInline]


@admin.register(Site)
class SiteAdmin(admin.ModelAdmin):
    list_display = ("name", "project", "address", "latitude", "longitude")
    list_filter = ("project",)
    search_fields = ("name", "address")
