# C# 예제 실행

C# 12 / .NET 8 SDK를 사용합니다. 외부 NuGet 패키지는 필요하지 않습니다.

저장소 루트에서 다음처럼 실행합니다. `NN`을 원하는 장 번호(01~31)로 바꾸세요.

```sh
dotnet run --project category-theory-course/examples/ChNN/ChNN.csproj --configuration Release
```

각 프로그램은 해당 장의 `data-csharp="true"` 전체 코드와 동일합니다. 조각 코드·실습 해답은 본문에 삽입 위치 또는 별도 전체 프로그램 여부를 표시했습니다. 실습은 접힌 해답을 보기 전에 직접 구현하세요.

웹 위젯은 같은 수학 규칙을 JavaScript로 계산하는 학습 모형이며 C#을 브라우저에서 컴파일하지 않습니다. 정의역, 값 동등성, 순수성과 유한 표본의 범위는 각 장에서 명시합니다.

| 장 | 주제 | 전체 실행 프로그램 |
|---|---|---|
| 01 | 범주와 합성 | [Program.cs](Ch01/Program.cs) |
| 02 | 타입과 함수 | [Program.cs](Ch02/Program.cs) |
| 03 | 크고 작은 범주 | [Program.cs](Ch03/Program.cs) |
| 04 | 클레이슬리 범주 | [Program.cs](Ch04/Program.cs) |
| 05 | 곱과 쌍대곱 | [Program.cs](Ch05/Program.cs) |
| 06 | 대수적 자료형 | [Program.cs](Ch06/Program.cs) |
| 07 | 함자 | [Program.cs](Ch07/Program.cs) |
| 08 | 함자성 | [Program.cs](Ch08/Program.cs) |
| 09 | 함수 타입 | [Program.cs](Ch09/Program.cs) |
| 10 | 자연변환 | [Program.cs](Ch10/Program.cs) |
| 11 | 선언적 프로그래밍 | [Program.cs](Ch11/Program.cs) |
| 12 | 극한과 쌍대극한 | [Program.cs](Ch12/Program.cs) |
| 13 | 자유 모노이드 | [Program.cs](Ch13/Program.cs) |
| 14 | 표현 가능한 함자 | [Program.cs](Ch14/Program.cs) |
| 15 | 요네다 보조정리 | [Program.cs](Ch15/Program.cs) |
| 16 | 요네다 매장 | [Program.cs](Ch16/Program.cs) |
| 17 | 사상으로 보는 구조 | [Program.cs](Ch17/Program.cs) |
| 18 | 수반 | [Program.cs](Ch18/Program.cs) |
| 19 | 자유·망각 수반 | [Program.cs](Ch19/Program.cs) |
| 20 | 프로그래머의 모나드 정의 | [Program.cs](Ch20/Program.cs) |
| 21 | 모나드와 효과 | [Program.cs](Ch21/Program.cs) |
| 22 | 범주론으로 정의하는 모나드 | [Program.cs](Ch22/Program.cs) |
| 23 | 코모나드 | [Program.cs](Ch23/Program.cs) |
| 24 | F-대수 | [Program.cs](Ch24/Program.cs) |
| 25 | 모나드의 대수 | [Program.cs](Ch25/Program.cs) |
| 26 | 엔드와 코엔드 | [Program.cs](Ch26/Program.cs) |
| 27 | 칸 확장 | [Program.cs](Ch27/Program.cs) |
| 28 | 풍성한 범주 | [Program.cs](Ch28/Program.cs) |
| 29 | 토포스 | [Program.cs](Ch29/Program.cs) |
| 30 | 로비어 이론 | [Program.cs](Ch30/Program.cs) |
| 31 | 모나드·모노이드·범주 | [Program.cs](Ch31/Program.cs) |

## 검증

구조·링크·C# 본문 동일성 검사:

```sh
python3 category-theory-course/tools/verify_course.py
```

.NET SDK 경로를 지정하면 모든 장을 Release로 실행하고 본문의 예상 출력과 비교합니다.

```sh
python3 category-theory-course/tools/verify_course.py --dotnet /path/to/dotnet
```

실제 브라우저 검사 방법과 결과는 [검증 기록](VALIDATION.md)을 확인하세요. 검증 도구는 Node.js 22 이상과 Python 3을 사용합니다.
