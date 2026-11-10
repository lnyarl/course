using System.Diagnostics;

var builder = WebApplication.CreateBuilder(args);
builder.Host.UseDefaultServiceProvider(options =>
{
    options.ValidateScopes = true;
    options.ValidateOnBuild = true;
});
// Change only this registration to AddSingleton or AddTransient, then restart.
builder.Services.AddScoped<Probe>();
var app = builder.Build();

// This outer boundary handles errors thrown by the following middleware/endpoints.
app.Use(async (context, next) =>
{
    try { await next(context); }
    catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested)
    {
        app.Logger.LogInformation("Request aborted {TraceId}", context.TraceIdentifier);
    }
    catch (Exception error)
    {
        app.Logger.LogError(error, "Request failed {TraceId}", context.TraceIdentifier);
        if (context.Response.HasStarted) throw;
        context.Response.Clear();
        await Results.Problem(statusCode: 500, title: "Learning failure")
            .ExecuteAsync(context);
    }
});
app.Use(async (context, next) =>
{
    var clock = Stopwatch.StartNew();
    app.Logger.LogInformation("IN {Path}", context.Request.Path);
    try { await next(context); }
    finally
    {
        // Outer error conversion has not necessarily run yet. Do not read a final
        // error status here and assume it is the status sent to the client.
        app.Logger.LogInformation("OUT {Path} elapsed={ElapsedMs}ms",
            context.Request.Path, clock.Elapsed.TotalMilliseconds);
    }
});

app.MapGet("/", () => Results.Ok(new
{
    endpoints = new[] { "/lifetime", "/delay?ms=200&mode=async", "/fail" },
    purpose = "Local learning only; no database, authentication, or durable queue."
}));
app.MapGet("/lifetime", (Probe first, Probe second) => Results.Ok(new
{
    first = first.Id,
    second = second.Id,
    same = ReferenceEquals(first, second)
}));
app.MapGet("/delay", async (int? ms, string? mode, CancellationToken cancellation) =>
{
    var delay = ms ?? 200;
    if (delay is < 0 or > 1000 || (mode is not null and not "async" and not "blocking"))
        return Results.BadRequest(new { error = "ms: 0..1000; mode: async | blocking" });
    var clock = Stopwatch.StartNew();
    if (mode == "blocking")
    {
        // Intentionally blocking, for comparison. Sleep itself does not observe cancellation.
        Thread.Sleep(delay);
        cancellation.ThrowIfCancellationRequested();
    }
    else await Task.Delay(delay, cancellation);
    return Results.Ok(new { mode = mode ?? "async", elapsedMs = clock.Elapsed.TotalMilliseconds });
});
app.MapGet("/fail", (Func<IResult>)(() => throw new InvalidOperationException("Injected failure")));
app.Run();

sealed class Probe : IDisposable
{
    public Guid Id { get; } = Guid.NewGuid();
    public void Dispose() => Console.WriteLine($"Disposed {Id}");
}
