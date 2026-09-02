# Note: Write/change models here, then run "python manage.py makemigrations"
# and "python manage.py migrate" to update data to form correct model

from django.db import models
from django.utils import timezone


# ACTIVITY LOG 
# Tracks recent system and user activity for the home dashboard "System Status" feed.

# Activity types tracked:
#   server_start       -> Server started/restarted
#   data_ingestion     -> TEMPO or OpenAir data ingestion completed (success or failure)
#   system_status      -> System health check or status change
#   notification       -> General notification/message


ACTIVITY_TYPES = [
    ('server_start', 'Server Start'),
    ('data_ingestion', 'Data Ingestion'),
    ('system_status', 'System Status'),
    ('notification', 'Notification'),
]

class ActivityLog(models.Model):
    activity_type = models.CharField(max_length=30, choices=ACTIVITY_TYPES, db_index=True)
    title = models.CharField(max_length=200)       # Short summary shown in the feed
    details = models.TextField(blank=True, default='')
    timestamp = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"[{self.activity_type}] {self.title} — {self.timestamp}"

def log_activity(activity_type, title, details=''):
    """Convenience function to record an activity from anywhere in the app."""
    ActivityLog.objects.create(
        activity_type=activity_type,
        title=title,
        details=details,
    )
