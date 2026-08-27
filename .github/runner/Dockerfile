FROM ubuntu:24.04

ARG RUNNER_VERSION=2.334.0

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    git \
    gnupg \
    jq \
    libicu74 \
    software-properties-common \
    sudo \
    tar \
    unzip \
  && add-apt-repository ppa:deadsnakes/ppa \
  && apt-get update \
  && apt-get install -y --no-install-recommends \
    python3.13 \
    python3.13-venv \
    python3.13-dev \
  && python3.13 -m ensurepip --upgrade \
  && python3.13 -m pip install --upgrade pip \
  && update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.13 1 \
  && update-alternatives --install /usr/bin/python python /usr/bin/python3.13 1 \
  && install -m 0755 -d /etc/apt/keyrings \
  && curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg \
  && chmod a+r /etc/apt/keyrings/docker.gpg \
  && . /etc/os-release \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $VERSION_CODENAME stable" > /etc/apt/sources.list.d/docker.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends docker-ce-cli docker-compose-plugin \
  && rm -rf /var/lib/apt/lists/*

RUN useradd -m -s /bin/bash runner \
  && usermod -aG sudo runner \
  && echo "runner ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/runner \
  && mkdir -p /home/runner/.npm /home/runner/.cache \
  && chown -R runner:runner /home/runner

WORKDIR /opt/actions-runner

RUN curl -fsSL -o actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz \
    https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz \
  && tar xzf actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz \
  && rm actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz \
  && ./bin/installdependencies.sh \
  && chown -R runner:runner /opt/actions-runner

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

USER runner

WORKDIR /home/runner/actions-runner

ENTRYPOINT ["/entrypoint.sh"]
