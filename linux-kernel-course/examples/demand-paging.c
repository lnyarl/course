#define _GNU_SOURCE
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <sys/mman.h>
#include <sys/resource.h>
static long faults(void) {
    struct rusage r;
    if (getrusage(RUSAGE_SELF,&r)) { perror("getrusage"); exit(1); }
    return r.ru_minflt;
}
int main(void) {
    const size_t size = 16UL * 1024 * 1024;
    long page = sysconf(_SC_PAGESIZE);
    if (page <= 0) return 1;
    unsigned char *p = mmap(NULL, size, PROT_READ|PROT_WRITE,
                           MAP_PRIVATE|MAP_ANONYMOUS, -1, 0);
    if (p == MAP_FAILED) { perror("mmap"); return 1; }
    setvbuf(stdout, NULL, _IONBF, 0);
    printf("mapped %zu bytes; page size %ld\n", size, page);
    long before = faults();
    for (size_t off=0; off<size; off+=(size_t)page)
        ((volatile unsigned char *)p)[off] = 1;
    long after = faults();
    printf("minor fault delta after writes: %ld\n", after-before);
    if (munmap(p,size)) { perror("munmap"); return 1; }
    return 0;
}
