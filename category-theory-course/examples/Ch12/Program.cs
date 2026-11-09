internal static class Program
{
    static void Main()
    {
        int[] domain = [-3, -2, -1, 0, 1, 2, 3];
        var equalizer = domain.Where(x => x * x == 1).ToArray();
        Console.WriteLine($"equalizer = {string.Join(",", equalizer)}");
        int[] f = [0, 1, 0], g = [0, 0, 1];
        var pairs = Enumerable.Range(0, 3).SelectMany(a => Enumerable.Range(0, 3).Where(c => f[a] == g[c]).Select(c => (a, c))).ToArray();
        Console.WriteLine($"pullback = {string.Join(",", pairs.Select(p => $"{p.a}:{p.c}"))}");
        var cone = new[]
        {
            (a: 0, c: 0),
            (a: 1, c: 2)
        };
        Console.WriteLine($"cone compatible = {cone.All(p => f[p.a] == g[p.c])}");
    }
}
