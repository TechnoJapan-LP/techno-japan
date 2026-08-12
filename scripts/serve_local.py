import http.server
import socketserver
import os
import sys

port = int(os.environ.get('PORT', 8080))
# このスクリプト自身は scripts/ にあるが、公開対象はサイトの生成物 LP/。
# scripts/ を公開すると /festivals.html などが 404 になる。
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'LP'))
handler = http.server.SimpleHTTPRequestHandler
with socketserver.TCPServer(("", port), handler) as httpd:
    print(f"Serving on port {port}")
    httpd.serve_forever()
