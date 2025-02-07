/*
 * This file is generated by jOOQ.
 */
package com.smotana.clearflask.store.mysql.model.tables;


import com.smotana.clearflask.store.mysql.model.DefaultSchema;
import com.smotana.clearflask.store.mysql.model.JooqIndexes;
import com.smotana.clearflask.store.mysql.model.JooqKeys;
import com.smotana.clearflask.store.mysql.model.tables.records.JooqCommentParentIdRecord;

import java.util.Arrays;
import java.util.List;

import javax.annotation.processing.Generated;

import org.jooq.Field;
import org.jooq.ForeignKey;
import org.jooq.Index;
import org.jooq.Name;
import org.jooq.Record;
import org.jooq.Row4;
import org.jooq.Schema;
import org.jooq.Table;
import org.jooq.TableField;
import org.jooq.TableOptions;
import org.jooq.UniqueKey;
import org.jooq.impl.DSL;
import org.jooq.impl.SQLDataType;
import org.jooq.impl.TableImpl;


/**
 * This class is generated by jOOQ.
 */
@Generated(
    value = {
        "https://www.jooq.org",
        "jOOQ version:3.16.10"
    },
    comments = "This class is generated by jOOQ"
)
@SuppressWarnings({ "all", "unchecked", "rawtypes" })
public class JooqCommentParentId extends TableImpl<JooqCommentParentIdRecord> {

    private static final long serialVersionUID = 1L;

    /**
     * The reference instance of <code>comment_parent_id</code>
     */
    public static final JooqCommentParentId COMMENT_PARENT_ID = new JooqCommentParentId();

    /**
     * The class holding records for this type
     */
    @Override
    public Class<JooqCommentParentIdRecord> getRecordType() {
        return JooqCommentParentIdRecord.class;
    }

    /**
     * The column <code>comment_parent_id.projectId</code>.
     */
    public final TableField<JooqCommentParentIdRecord, String> PROJECTID = createField(DSL.name("projectId"), SQLDataType.VARCHAR(54).nullable(false), this, "");

    /**
     * The column <code>comment_parent_id.postId</code>.
     */
    public final TableField<JooqCommentParentIdRecord, String> POSTID = createField(DSL.name("postId"), SQLDataType.VARCHAR(54).nullable(false), this, "");

    /**
     * The column <code>comment_parent_id.commentId</code>.
     */
    public final TableField<JooqCommentParentIdRecord, String> COMMENTID = createField(DSL.name("commentId"), SQLDataType.VARCHAR(54).nullable(false), this, "");

    /**
     * The column <code>comment_parent_id.parentCommentId</code>.
     */
    public final TableField<JooqCommentParentIdRecord, String> PARENTCOMMENTID = createField(DSL.name("parentCommentId"), SQLDataType.VARCHAR(54).nullable(false), this, "");

    private JooqCommentParentId(Name alias, Table<JooqCommentParentIdRecord> aliased) {
        this(alias, aliased, null);
    }

    private JooqCommentParentId(Name alias, Table<JooqCommentParentIdRecord> aliased, Field<?>[] parameters) {
        super(alias, null, aliased, parameters, DSL.comment(""), TableOptions.table());
    }

    /**
     * Create an aliased <code>comment_parent_id</code> table reference
     */
    public JooqCommentParentId(String alias) {
        this(DSL.name(alias), COMMENT_PARENT_ID);
    }

    /**
     * Create an aliased <code>comment_parent_id</code> table reference
     */
    public JooqCommentParentId(Name alias) {
        this(alias, COMMENT_PARENT_ID);
    }

    /**
     * Create a <code>comment_parent_id</code> table reference
     */
    public JooqCommentParentId() {
        this(DSL.name("comment_parent_id"), null);
    }

    public <O extends Record> JooqCommentParentId(Table<O> child, ForeignKey<O, JooqCommentParentIdRecord> key) {
        super(child, key, COMMENT_PARENT_ID);
    }

    @Override
    public Schema getSchema() {
        return aliased() ? null : DefaultSchema.DEFAULT_SCHEMA;
    }

    @Override
    public List<Index> getIndexes() {
        return Arrays.asList(JooqIndexes.COMMENT_PARENT_ID_COMMENT_PARENT_ID_PROJECTID_POSTID_IDX);
    }

    @Override
    public UniqueKey<JooqCommentParentIdRecord> getPrimaryKey() {
        return JooqKeys.KEY_COMMENT_PARENT_ID_PRIMARY;
    }

    @Override
    public List<ForeignKey<JooqCommentParentIdRecord, ?>> getReferences() {
        return Arrays.asList(JooqKeys.COMMENT_PARENT_ID_IBFK_1);
    }

    private transient JooqComment _comment;

    /**
     * Get the implicit join path to the <code>clearflask.comment</code> table.
     */
    public JooqComment comment() {
        if (_comment == null)
            _comment = new JooqComment(this, JooqKeys.COMMENT_PARENT_ID_IBFK_1);

        return _comment;
    }

    @Override
    public JooqCommentParentId as(String alias) {
        return new JooqCommentParentId(DSL.name(alias), this);
    }

    @Override
    public JooqCommentParentId as(Name alias) {
        return new JooqCommentParentId(alias, this);
    }

    /**
     * Rename this table
     */
    @Override
    public JooqCommentParentId rename(String name) {
        return new JooqCommentParentId(DSL.name(name), null);
    }

    /**
     * Rename this table
     */
    @Override
    public JooqCommentParentId rename(Name name) {
        return new JooqCommentParentId(name, null);
    }

    // -------------------------------------------------------------------------
    // Row4 type methods
    // -------------------------------------------------------------------------

    @Override
    public Row4<String, String, String, String> fieldsRow() {
        return (Row4) super.fieldsRow();
    }
}
