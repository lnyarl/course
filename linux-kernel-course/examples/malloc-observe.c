#define _GNU_SOURCE
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <sys/resource.h>
#ifdef __GLIBC__
#include <malloc.h>
#endif

static void snapshot(const char *label) {
    struct rusage usage;
    if (getrusage(RUSAGE_SELF, &usage) != 0) { perror("getrusage"); exit(1); }
    printf("\n[%s] minor_faults=%ld\n", label, usage.ru_minflt);
    FILE *f = fopen("/proc/self/status", "r");
    if (!f) { perror("/proc/self/status: run on Linux"); exit(1); }
    char line[256];
    while (fgets(line, sizeof line, f))
        if (!strncmp(line, "VmSize:", 7) || !strncmp(line, "VmRSS:", 6) || !strncmp(line, "RssAnon:", 8))
            fputs(line, stdout);
    fclose(f);
}
int main(void) {
    enum { COUNT = 4096, BLOCK = 4096 }; /* payload: 16 MiB, bounded */
    static unsigned char *blocks[COUNT];
    setvbuf(stdout, NULL, _IONBF, 0);
    snapshot("before");
    for (size_t i=0; i<COUNT; i++) {
        blocks[i] = malloc(BLOCK);
        if (!blocks[i]) {
            perror("malloc");
            while (i) free(blocks[--i]);
            return 1;
        }
    }
    snapshot("malloc only (metadata may already touch pages)");
    for (size_t i=0; i<COUNT; i++) {
        volatile unsigned char *p = blocks[i];
        for (size_t j=0; j<BLOCK; j++) p[j] = 1;
    }
    snapshot("after payload writes");
    for (size_t i=0; i<COUNT; i++) free(blocks[i]);
    snapshot("after free");
#ifdef __GLIBC__
    printf("malloc_trim returned %d\n", malloc_trim(0));
    snapshot("after explicit trim");
#else
    puts("malloc_trim is a glibc extension; skipped on this libc.");
#endif
    return 0;
}
