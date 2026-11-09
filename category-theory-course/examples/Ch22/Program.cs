int[][][] nested = [ [ [1], [2] ], [ [3] ] ];
var outerFirst = Join(Join(nested));
var innerFirst = Join(nested.Select(Join).ToArray());
Console.WriteLine(string.Join(",", outerFirst));
Console.WriteLine(outerFirst.SequenceEqual(innerFirst));
int[] xs = [2, 3];
Console.WriteLine(Join(new[] { xs }).SequenceEqual(xs));
Console.WriteLine(Join(xs.Select(x => new[] { x }).ToArray()).SequenceEqual(xs));
static A[] Join<A>(A[][] lists) => lists.SelectMany(x => x).ToArray();
