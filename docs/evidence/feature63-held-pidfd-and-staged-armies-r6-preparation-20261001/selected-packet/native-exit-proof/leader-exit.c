#include <pthread.h>
#include <stdlib.h>
#include <unistd.h>

static int ready_fd;
static int worker_fd;

static void *worker(void *unused) {
    (void)unused;
    char byte;
    if (write(ready_fd, "W", 1) != 1) _exit(21);
    if (read(worker_fd, &byte, 1) < 0) _exit(22);
    return NULL;
}

int main(int argc, char **argv) {
    if (argc != 4) return 10;
    ready_fd = atoi(argv[1]);
    int leader_fd = atoi(argv[2]);
    worker_fd = atoi(argv[3]);
    pthread_t thread;
    if (pthread_create(&thread, NULL, worker, NULL)) return 11;
    if (write(ready_fd, "M", 1) != 1) return 12;
    char byte;
    if (read(leader_fd, &byte, 1) < 0) return 13;
    pthread_exit(NULL);
}
