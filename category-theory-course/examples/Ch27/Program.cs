using System;
int lower = 1, upper = 4;
int count = 0;
for (int x = 0; x <= 5; x++) if (lower <= x && x <= upper) count++;
Console.WriteLine($"exact extensions = {count}");
Console.WriteLine($"Lan(1) = {lower}");
Console.WriteLine($"Ran(1) = {upper}");
var mediator = (A: 1, B: 2);
Console.WriteLine($"Ran projections = {mediator.A},{mediator.B}");
