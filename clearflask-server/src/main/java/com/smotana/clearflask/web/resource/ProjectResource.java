package com.smotana.clearflask.web.resource;

import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableSet;
import com.google.common.collect.Sets;
import com.google.common.util.concurrent.Futures;
import com.smotana.clearflask.api.ProjectAdminApi;
import com.smotana.clearflask.api.ProjectApi;
import com.smotana.clearflask.api.model.ConfigAdmin;
import com.smotana.clearflask.api.model.ConfigAndBindResult;
import com.smotana.clearflask.api.model.ConfigGetAllResult;
import com.smotana.clearflask.api.model.NewProjectResult;
import com.smotana.clearflask.api.model.UserMeWithBalance;
import com.smotana.clearflask.api.model.VersionedConfigAdmin;
import com.smotana.clearflask.security.limiter.Limit;
import com.smotana.clearflask.store.AccountStore;
import com.smotana.clearflask.store.AccountStore.Account;
import com.smotana.clearflask.store.AccountStore.AccountSession;
import com.smotana.clearflask.store.ProjectStore;
import com.smotana.clearflask.store.ProjectStore.Project;
import com.smotana.clearflask.store.UserStore;
import com.smotana.clearflask.util.ModelUtil;
import com.smotana.clearflask.web.ErrorWithMessageException;
import com.smotana.clearflask.web.security.ExtendedSecurityContext.ExtendedPrincipal;
import com.smotana.clearflask.web.security.Role;
import lombok.extern.slf4j.Slf4j;

import javax.annotation.security.PermitAll;
import javax.annotation.security.RolesAllowed;
import javax.inject.Inject;
import javax.inject.Singleton;
import javax.ws.rs.InternalServerErrorException;
import javax.ws.rs.Path;
import javax.ws.rs.core.Response;
import java.util.Optional;

@Slf4j
@Singleton
@Path("/v1")
public class ProjectResource extends AbstractResource implements ProjectApi, ProjectAdminApi {

    @Inject
    private ProjectStore projectStore;
    @Inject
    private AccountStore accountStore;
    @Inject
    private UserStore userStore;
    @Inject
    private UserStore ideaStore;

    @PermitAll
    @Limit(requiredPermits = 10)
    @Override
    public ConfigAndBindResult configGetAndUserBind(String projectId) {
        Optional<Project> projectOpt = projectStore.getProject(projectId, true);
        if (!projectOpt.isPresent()) {
            throw new ErrorWithMessageException(Response.Status.NOT_FOUND, "Project not found");
        }
        Optional<UserMeWithBalance> userMeWithBalanceOpt = getExtendedPrincipal().flatMap(ExtendedPrincipal::getUserSessionOpt)
                .map(UserStore.UserSession::getUserId)
                .flatMap(userId -> userStore.getUser(projectId, userId))
                .map(UserStore.UserModel::toUserMeWithBalance);
        return new ConfigAndBindResult(
                projectOpt.get().getVersionedConfig(),
                userMeWithBalanceOpt.orElse(null));
    }

    @RolesAllowed({Role.PROJECT_OWNER})
    @Limit(requiredPermits = 1)
    @Override
    public VersionedConfigAdmin configGetAdmin(String projectId) {
        Optional<Project> projectOpt = projectStore.getProject(projectId, false);
        if (!projectOpt.isPresent()) {
            throw new ErrorWithMessageException(Response.Status.NOT_FOUND, "Project not found");
        }
        return projectOpt.get().getVersionedConfigAdmin();
    }

    @RolesAllowed({Role.ADMINISTRATOR})
    @Limit(requiredPermits = 1)
    @Override
    public ConfigGetAllResult configGetAllAdmin() {
        AccountSession accountSession = getExtendedPrincipal().flatMap(ExtendedPrincipal::getAccountSessionOpt).get();
        Account account = accountStore.getAccount(accountSession.getEmail()).orElseThrow(() -> {
            log.error("Account not found for session with email {}", accountSession.getEmail());
            return new InternalServerErrorException();
        });
        ImmutableSet<Project> projects = projectStore.getProjects(account.getProjectIds(), false);
        if (account.getProjectIds().size() != projects.size()) {
            log.error("ProjectIds on account not found in project table, email {} missing projects {}",
                    account.getEmail(), Sets.difference(account.getProjectIds(), projects.stream()
                            .map(c -> c.getVersionedConfigAdmin().getConfig().getProjectId()).collect(ImmutableSet.toImmutableSet())));
        }
        return new ConfigGetAllResult(projects.stream()
                .map(Project::getVersionedConfigAdmin)
                .collect(ImmutableList.toImmutableList()));
    }

    @RolesAllowed({Role.PROJECT_OWNER})
    @Limit(requiredPermits = 1)
    @Override
    public VersionedConfigAdmin configSetAdmin(String projectId, String versionLast, ConfigAdmin configAdmin) {
        VersionedConfigAdmin versionedConfigAdmin = new VersionedConfigAdmin(configAdmin, ModelUtil.createConfigVersion());
        projectStore.updateConfig(projectId, versionLast, versionedConfigAdmin);
        return versionedConfigAdmin;
    }

    @RolesAllowed({Role.ADMINISTRATOR})
    @Limit(requiredPermits = 1)
    @Override
    public NewProjectResult projectCreateAdmin(String projectId) {
        // TODO sanity check, projectId alphanumeric
        VersionedConfigAdmin configAdmin = ModelUtil.createEmptyConfig(projectId);
        projectStore.createProject(projectId, configAdmin);
        Futures.allAsList(
                userStore.createIndex(projectId),
                ideaStore.createIndex(projectId)
        );
        return new NewProjectResult(projectId, configAdmin);
    }
}