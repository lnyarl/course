readonly record struct Pair<T>(T First, T Second);
internal static class Program
{
    static Pair<A> Tabulate<A>(Func<bool, A> f) => new(f(false), f(true));
    static A Index<A>(Pair<A> p, bool key) => key ? p.Second : p.First;
    static Pair<B> Map<A, B>(Pair<A> p, Func<A, B> f) => new(f(p.First), f(p.Second));
    static void Main()
    {
        Func<bool, int> f = b => b ? 7 : 3;
        var table = Tabulate(f);
        Console.WriteLine($"pair = ({table.First},{table.Second})");
        Console.WriteLine($"index/tabulate = {new[] { false, true }.All(k => Index(Tabulate(f), k) == f(k))}");
        Func<bool, int> indexed = k => Index(table, k);
        Console.WriteLine($"tabulate/index = {Tabulate(indexed) == table}");
        Func<int, int> g = x => x * 2;
        Console.WriteLine($"natural = {Map(table, g) == Tabulate<int>(k => g(f(k)))}");
    }
}
