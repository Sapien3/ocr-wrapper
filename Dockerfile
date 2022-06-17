FROM ubuntu:20.04

ARG DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    git \
    ca-certificates \
    npm \
    tesseract-ocr \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /home
RUN git clone https://github.com/Sapien3/ocr-wrapper.git

WORKDIR /home/ocr-wrapper
RUN npm install
EXPOSE 3070
CMD ["npm", "start"]