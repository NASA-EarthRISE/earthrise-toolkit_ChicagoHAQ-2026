#This is a general tip page for navigating future django code
# 1. Write a print command so that your web browser http link shows up every run

# 2. Go and peek at definitions of object by right clicking and selecting 'Go to Definition'. 
#    This will show you where objects are defined and coming from throughout your codes

# 3. Avoid using html codes as it opens the app to cross-site scripting (XSS) attacks. Instead, use templates!
#    To make a template, create a 'template' folder under the app folder, and another folder under template that has the same name of the app. 
#    In this case, that folder is called 'dashboard'. Make an html file under the template>'dashboard' folder

# 4. Every componenet or link needs to also be added to views in order to display on the webpage

# 5. STATIC FILES: We may be using a .csv data file that is static, and does not update in real time. Make sure
#    to import 'django.contrib.staticfiles' to 'urls.py' if not already included. Create a subfolder of dashboard>static>'dashboard'> and add static datafile into the last folder (like with htmls in Step 3)



