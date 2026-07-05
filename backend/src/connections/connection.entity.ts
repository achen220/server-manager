import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('connections')
export class ConnectionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column()
  host!: string;

  @Column({ default: 22 })
  port!: number;

  @Column()
  username!: string;

  @Column({ type: 'varchar', default: 'password' })
  authType!: 'password' | 'key';

  /** Never returned in list/get — only fetched explicitly for SSH use */
  @Column({ nullable: true, select: false })
  password?: string;

  /** Encrypted SSH private key content — never returned in list/get */
  @Column({ nullable: true, select: false, name: 'private_key_path' })
  privateKey?: string;

  @Column({ nullable: true })
  description?: string;

  /** Supabase user UUID — users can only access their own connections */
  @Column()
  userId!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
