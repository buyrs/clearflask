package com.smotana.clearflask.core.push.provider;

import com.smotana.clearflask.core.push.PushProvider;

// TODO
public class AndroidPushProvider implements PushProvider {
    @Override
    public boolean send(NotificationModel notification, String subscription) {
        return false;
    }
}