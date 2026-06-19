package com.ucgi.integrationapi.mikopbx;

public class MikoPbxException extends RuntimeException {

    private final int statusCode;

    public MikoPbxException(String message) {
        super(message);
        this.statusCode = -1;
    }

    public MikoPbxException(String message, int statusCode) {
        super(message);
        this.statusCode = statusCode;
    }

    public MikoPbxException(String message, Throwable cause) {
        super(message, cause);
        this.statusCode = -1;
    }

    public int getStatusCode() {
        return statusCode;
    }
}
