#!/bin/sh
# Start both HTTP and gRPC servers
node server.js &
node grpc-server.js &
wait
