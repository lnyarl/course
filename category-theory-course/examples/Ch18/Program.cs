Func<(int, int), int> f = p => p.Item1 + p.Item2;
var curried = Curry(f);
var roundtrip = Uncurry(curried);
Console.WriteLine(curried(4)(3));
Console.WriteLine(roundtrip((4,3)));
Func<int, (int, int)> unit = s => (4,s);
var original = (Value: 4, State: 3);
// Lη_A(a,s) = (η_A(a),s), then ε evaluates the function.
var lifted = (Function: unit, State: original.State);
var triangle = lifted.Function(lifted.State);
Console.WriteLine($"{triangle.Item1},{triangle.Item2}");
static Func<A, Func<S,B>> Curry<A,S,B>(Func<(A,S),B> f)
    => a => s => f((a,s));
static Func<(A,S),B> Uncurry<A,S,B>(Func<A,Func<S,B>> g)
    => p => g(p.Item1)(p.Item2);
