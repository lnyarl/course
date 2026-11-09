char[] word = ['a','b','a'];
static int K(char c) => c == 'a' ? 2 : 3;
static int Fold(IEnumerable<char> xs) => xs.Aggregate(0, (acc,c) => acc + K(c));
Console.WriteLine(Fold(word));
char[] u = ['a','b'], v = ['a'];
Console.WriteLine(Fold(u.Concat(v)) == Fold(u) + Fold(v));
Console.WriteLine(Fold(Array.Empty<char>()));
Console.WriteLine(Fold(new[]{'a'}) == K('a'));
