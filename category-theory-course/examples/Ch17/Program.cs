int[] xs = [2, 3];
Func<int,int> f = x => x + 1, g = x => 2 * x;
var path1 = xs.Select(f).Select(g).ToArray();
var path2 = xs.Select(x => g(f(x))).ToArray();
Console.WriteLine(string.Join(",", path1));
Console.WriteLine(path1.SequenceEqual(path2));
Console.WriteLine(xs.Length == xs.Select(_ => "changed").Count());
Console.WriteLine($"Hom(2,3)={Pow(3,2)}, Hom(3,2)={Pow(2,3)}");
static int Pow(int b, int e) => Enumerable.Repeat(b, e).Aggregate(1, (x,y) => x*y);
