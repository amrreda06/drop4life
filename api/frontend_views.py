from django.shortcuts import render


def index_view(request):
    return render(request, 'drop4life.html')
