internal static class Program
{
    static (C, D) Bimap<A, B, C, D>((A, B) pair, Func<A, C> f, Func<B, D> g) => (f(pair.Item1), g(pair.Item2));
    static Func<A, bool> Contra<A, B>(Func<A, B> f, Func<B, bool> p) => a => p(f(a));
    static Func<X, Y> Dimap<X, A, B, Y>(Func<X, A> pre, Func<B, Y> post, Func<A, B> f) => x => post(f(pre(x)));
    static void Main()
    {
        var pair = Bimap((2, "abc"), n => n + 1, s => s.Length);
        Console.WriteLine($"bimap = ({pair.Item1},{pair.Item2})");
        Func<string, int> length = s => s.Length;
        Func<int, bool> large = n => n > 2;
        Console.WriteLine($"predicate(abcd) = {Contra(length, large)("abcd")}");
        Func<int, int> twice = n => n * 2;
        Func<int, string> label = n => $"v={n}";
        Console.WriteLine($"dimap(abcd) = {Dimap(length, label, twice)("abcd")}");
    }
}
