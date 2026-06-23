#Here, you specify patterns to route different URLs to their appropriate views
# Terminal command for running/updating server: python manage.py runserver

from django.urls import path
from dashboard import views



#Note: Home was defined as a function in "views.py" that acts a request
urlpatterns = [
    #Old home link: path("", views.home, name="home"),
    path("", views.home, name = "home"),
    path("status/", views.statushome, name = "status"),
    path("about/", views.about, name="about"),
    path("info/", views.info, name="info"),
    path('map/', views.map_view, name='map'),
    path('api/markers/', views.map_markers_api, name='markers-api'),
    path('tutorial/', views.tutorial, name="tutorial"),

]

