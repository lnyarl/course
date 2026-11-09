using System;
using System.Linq;
readonly record struct Arrow(string Name, int Dom, int Cod);
static class Program
{
    static void Main()
    {
        Arrow[] arrows = [new("idA", 0, 0), new("f", 0, 1), new("idB", 1, 1)];
        var pairs = from f in arrows from g in arrows where f.Cod == g.Dom select (f, g);
        Console.WriteLine($"pullback pairs = {pairs.Count()}");
        foreach (var (f, g) in pairs)
        {
            Arrow composite = arrows.Single(h => h.Dom == f.Dom && h.Cod == g.Cod);
            Console.WriteLine($"{g.Name} after {f.Name} = {composite.Name}");
        }
    }
}
