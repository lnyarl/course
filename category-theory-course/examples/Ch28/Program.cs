using System;
int[] points = [0, 2, 5];
bool triangle = true, nonexpanding = true;
foreach (int x in points)
    foreach (int y in points)
        foreach (int z in points)
            triangle &= Math.Abs(x - z) <= Math.Abs(x - y) + Math.Abs(y - z);
foreach (int x in points)
    foreach (int y in points)
        nonexpanding &= Math.Abs(2 * x - 2 * y) <= Math.Abs(x - y);
Console.WriteLine($"triangles = {triangle}");
Console.WriteLine($"scale 2 nonexpanding = {nonexpanding}");
