INTERNAL_ALLOWED_HOSTS = ("backend", "localhost", "127.0.0.1")


def split_csv(value):
    return [item.strip() for item in value.split(",") if item.strip()]


def build_allowed_hosts(raw_value):
    hosts = split_csv(raw_value)
    if "*" in hosts:
        return hosts

    merged_hosts = []
    for host in [*hosts, *INTERNAL_ALLOWED_HOSTS]:
        if host not in merged_hosts:
            merged_hosts.append(host)
    return merged_hosts
