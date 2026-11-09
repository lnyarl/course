using System;
using System.Collections.Generic;
using System.Linq;
using System.Numerics;

internal static class Program
{
    readonly record struct Edge(string Name, int From, int To);
    readonly record struct Path(int From, int To, string Word, int Length);

    // 표시·검사용 유한 열거. 전체 자유 범주를 유한하다고 가정하지 않는다.
    static List<Path> PathsUpTo(int objects, Edge[] edges, int bound)
    {
        var frontier = Enumerable.Range(0, objects)
            .Select(i => new Path(i, i, "", 0)).ToList();
        var all = new List<Path>(frontier);
        for (int length = 0; length < bound; length++)
        {
            var next = new List<Path>();
            foreach (var path in frontier)
            foreach (var edge in edges)
                if (path.To == edge.From)
                    next.Add(new Path(path.From, edge.To,
                        path.Word + edge.Name, path.Length + 1));
            all.AddRange(next);
            frontier = next;
        }
        return all;
    }

    static bool Preorder(bool[,] relation)
    {
        int n = relation.GetLength(0);
        for (int a = 0; a < n; a++)
        {
            if (!relation[a, a]) return false;
            for (int b = 0; b < n; b++)
            for (int c = 0; c < n; c++)
                if (relation[a, b] && relation[b, c] && !relation[a, c])
                    return false;
        }
        return true;
    }

    static bool Poset(bool[,] relation)
    {
        if (!Preorder(relation)) return false;
        int n = relation.GetLength(0);
        for (int a = 0; a < n; a++)
        for (int b = a + 1; b < n; b++)
            if (relation[a, b] && relation[b, a]) return false;
        return true;
    }

    static void Main()
    {
        Edge[] triangle = [new("a", 0, 1), new("b", 1, 2), new("c", 0, 2)];
        var paths = PathsUpTo(3, triangle, 2);
        Console.WriteLine($"triangle paths <= 2 = {paths.Count}");
        Console.WriteLine($"A -> C = {string.Join(",", paths
            .Where(p => p.From == 0 && p.To == 2).Select(p => p.Word))}");
        var loop = PathsUpTo(1, [new Edge("l", 0, 0)], 3);
        Console.WriteLine($"loop paths <= 3 = {string.Join(",", loop
            .Select(p => p.Length == 0 ? "id_A" : p.Word))}");
        Console.WriteLine($"empty category paths = {PathsUpTo(0, [], 3).Count}");

        bool[,] cycle = { { true, true }, { true, true } };
        bool[,] chain = { { true, true }, { false, true } };
        Console.WriteLine($"cycle preorder = {Preorder(cycle)}");
        Console.WriteLine($"cycle poset = {Poset(cycle)}");
        Console.WriteLine($"chain poset = {Poset(chain)}");

        string a = "a", b = "b", c = "c", unit = "";
        Console.WriteLine($"concat associativity = {((a + b) + c == a + (b + c))}");
        Console.WriteLine($"concat identity = {(unit + a == a && a + unit == a)}");
        BigInteger large = BigInteger.Pow(2, 100);
        Console.WriteLine($"addition sample = {((large + 7) + 9 == large + (7 + 9))}");

        Func<string, string> f = x => "foo" + x;
        Func<string, string> g = x => "bar" + x;
        Console.WriteLine($"g after f (prepend) = {g(f("x"))}");
        Console.WriteLine($"g * f = {"bar" + "foo"}");
    }
}
