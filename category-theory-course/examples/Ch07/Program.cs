readonly record struct Option<T>(bool HasValue, T Value);
internal static class Program
{
    static Option<B> Map<A, B>(Option<A> x, Func<A, B> f) => x.HasValue ? new(true, f(x.Value)) : new(false, default !);
    static Func<R, B> MapReader<R, A, B>(Func<R, A> r, Func<A, B> f) => env => f(r(env));
    static void Main()
    {
        var x = new Option<int>(true, 2);
        Func<int, int> f = n => n + 1, g = n => n * 2;
        var a = Map(Map(x, f), g);
        var b = Map(x, n => g(f(n)));
        Console.WriteLine($"option composition = {a == b}");
        var none = new Option<int>(false, 0);
        Console.WriteLine($"none stays None = {!Map(none, f).HasValue}");
        Console.WriteLine($"list = {string.Join(",", new[] { 1, 2, 3 }.Select(g))}");
        Func<int, int> reader = env => env + 3;
        Console.WriteLine($"reader(4) = {MapReader(reader, g)(4)}");
    }
}
