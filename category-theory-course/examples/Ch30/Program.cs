using System;
using System.Linq;
static string Evaluate(string term, string x, string y) => string.Concat(term.Select(c => c == 'x' ? x : y));
Console.WriteLine($"xyx = {Evaluate("xyx", "A", "B")}");
Console.WriteLine($"empty = [{Evaluate("", "A", "B")}]");
string substitute = Evaluate("xyx", "xy", "yx");
Console.WriteLine($"substitution = {substitute}");
Console.WriteLine($"associative = {("A" + "B") + "C" == "A" + ("B" + "C")}");
