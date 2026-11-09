readonly record struct Option<T>(bool HasValue, T Value);
internal static class Program
{
    static Option<B> Map<A, B>(Option<A> x, Func<A, B> f) => x.HasValue ? new(true, f(x.Value)) : new(false, default !);
    static Option<A> Head<A>(IReadOnlyList<A> x) => x.Count == 0 ? new(false, default !) : new(true, x[0]);
    static A[] Pack<A>(Option<A> x) => x.HasValue ? [x.Value] : [];
    static void Main()
    {
        int[] xs = [1, 3];
        Func<int, int> negate = n => -n;
        var left = Map(Head(xs), negate);
        var right = Head(xs.Select(negate).ToArray());
        Console.WriteLine($"head natural = {left == right}");
        Console.WriteLine($"empty natural = {Map(Head(Array.Empty<int>()), negate) == Head(Array.Empty<int>())}");
        Console.WriteLine($"max natural = {negate(xs.Max()) == xs.Select(negate).Max()}");
        var some = new Option<int>(true, 3);
        Console.WriteLine($"option roundtrip = {Head(Pack(some)) == some}");
    }
}
