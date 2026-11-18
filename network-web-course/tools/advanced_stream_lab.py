#!/usr/bin/env python3
"""Verify normal Last-Event-ID replay and resync against a loopback HTTP server."""

from http.client import HTTPConnection
from http.server import BaseHTTPRequestHandler, HTTPServer
from threading import Thread


class EventStream(BaseHTTPRequestHandler):
    events = (4, 5, 6)

    def do_GET(self):
        if self.path != "/events":
            self.send_error(404)
            return
        try:
            cursor = int(self.headers.get("Last-Event-ID", "0"))
        except ValueError:
            self.send_error(400)
            return

        first = self.events[0]
        if cursor < first - 1:
            # Teaching contract: this application requires an explicit snapshot refresh.
            body = b'{"action":"snapshot","latest":6}'
            self.send_response(409)
            self.send_header("Content-Type", "application/json")
        else:
            body = "".join(f"id: {n}\ndata: event-{n}\n\n" for n in self.events if n > cursor).encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass


def get(port, cursor):
    connection = HTTPConnection("127.0.0.1", port, timeout=3)
    try:
        connection.request("GET", "/events", headers={"Last-Event-ID": str(cursor)})
        response = connection.getresponse()
        return response.status, response.read().decode()
    finally:
        connection.close()


def main():
    with HTTPServer(("127.0.0.1", 0), EventStream) as server:
        thread = Thread(target=server.serve_forever)
        thread.start()
        try:
            port = server.server_port
            status, body = get(port, 3)
            ids = [line[4:] for line in body.splitlines() if line.startswith("id: ")]
            if status != 200 or ids != ["4", "5", "6"]:
                raise AssertionError((status, body))
            print("PASS cursor=3 -> 200, replay IDs 4,5,6")
            status, body = get(port, 5)
            if status != 200 or body.count("id: ") != 1 or "id: 6\n" not in body:
                raise AssertionError((status, body))
            print("PASS cursor=5 -> 200, replay ID 6 only")
            status, body = get(port, 2)
            if status != 409 or body != '{"action":"snapshot","latest":6}':
                raise AssertionError((status, body))
            print("PASS cursor=2 -> 409, application requires a snapshot")
        finally:
            server.shutdown()
            thread.join()


if __name__ == "__main__":
    main()
