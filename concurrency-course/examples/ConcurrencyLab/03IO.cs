using System.Diagnostics;
using System.Net;
using System.Net.Sockets;
using System.Text;

namespace ConcurrencyLab;

internal static class Week03
{
    public static async Task Run()
    {
        var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        using var stop = new CancellationTokenSource();
        var handlers = new List<Task>();
        var server = Serve();
        var port = ((IPEndPoint)listener.LocalEndpoint).Port;
        using var client = new HttpClient(new SocketsHttpHandler { UseProxy = false })
        { Timeout = TimeSpan.FromSeconds(3) };
        var url = $"http://127.0.0.1:{port}/";
        try
        {
            var watch = Stopwatch.StartNew();
            for (var i = 0; i < 6; i++) Check.That(await client.GetStringAsync(url) == "ok", "응답 오류");
            Console.WriteLine($"순차 요청 6개: {watch.Elapsed.TotalMilliseconds:F1} ms");
            watch.Restart();
            var values = await Task.WhenAll(Enumerable.Range(0, 6).Select(_ => client.GetStringAsync(url)));
            Check.That(values.All(value => value == "ok"), "응답 오류");
            Console.WriteLine($"비동기 동시 요청 6개: {watch.Elapsed.TotalMilliseconds:F1} ms");
            Console.WriteLine("서버의 요청별 대기는 80 ms 그대로입니다. 대기를 겹쳐 전체 시간이 줄어듭니다.");
        }
        finally
        {
            stop.Cancel();
            listener.Stop();
            await server;
            await Task.WhenAll(handlers);
        }

        async Task Serve()
        {
            try
            {
                while (!stop.IsCancellationRequested)
                {
                    var connection = await listener.AcceptTcpClientAsync(stop.Token);
                    handlers.Add(Handle(connection));
                }
            }
            catch (OperationCanceledException) when (stop.IsCancellationRequested) { }
            catch (SocketException) when (stop.IsCancellationRequested) { }
            catch (ObjectDisposedException) when (stop.IsCancellationRequested) { }
        }

        static async Task Handle(TcpClient connection)
        {
            using (connection)
            {
                using var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(3));
                await using var stream = connection.GetStream();
                using var reader = new StreamReader(stream, Encoding.ASCII, false, 1024, leaveOpen: true);
                while (await reader.ReadLineAsync(deadline.Token) is { Length: > 0 }) { }
                await Task.Delay(80, deadline.Token);
                var bytes = Encoding.ASCII.GetBytes("HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\nok");
                await stream.WriteAsync(bytes, deadline.Token);
            }
        }
    }
}
