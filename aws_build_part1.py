"""AWS Repo Builder - Part 1: Fundamentals, Core Services, Compute"""
import pathlib
BASE = pathlib.Path(r"D:\1.projects\AI\my-aws")

def w(rel, content):
    p = BASE / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content.lstrip("\n"), encoding="utf-8")
    print(f"  OK  {rel}")

w("fundamentals/01_cloud_concepts.md", """
# AWS Fundamentals — Cloud Concepts & Global Infrastructure

## Cloud Computing Models

| Model | You Manage | AWS Manages | Examples |
|-------|-----------|-------------|---------|
| IaaS | OS, runtime, apps, data | Physical infra, virtualization | EC2, EBS, VPC |
| PaaS | Apps, data | OS, runtime, middleware | Elastic Beanstalk, RDS |
| SaaS | Data, access | Everything | WorkMail, QuickSight |
| Serverless | Business logic | Everything else | Lambda, Fargate |

## AWS Global Infrastructure

### Regions
AWS has 33+ regions worldwide. Each region is a geographic area with multiple isolated datacenters.

**Region selection criteria:**
1. **Latency** — proximity to users
2. **Compliance** — data residency requirements (GDPR → EU regions)
3. **Service availability** — not all services in all regions
4. **Cost** — prices vary (us-east-1 often cheapest)
5. **Disaster recovery** — pair with another region

### Availability Zones (AZs)
- Each region has 2–6 AZs (typically 3)
- AZs are physically separated datacenters connected via high-bandwidth, low-latency links
- Named: us-east-1a, us-east-1b, us-east-1c
- **Best practice**: Deploy across 2+ AZs for high availability

### Edge Locations
- 400+ edge locations worldwide
- Used by CloudFront (CDN), Route 53, WAF
- Cache content closer to users to reduce latency

## Shared Responsibility Model

```
AWS Responsibility (Security OF the Cloud):
├── Physical security of datacenters
├── Hardware, networking, virtualization
└── Managed service software (RDS OS patching)

Customer Responsibility (Security IN the Cloud):
├── Data encryption (at rest and in transit)
├── IAM (users, roles, permissions)
├── OS patching (for EC2)
├── Network configuration (Security Groups, NACLs)
└── Application security
```

## AWS Pricing Models

| Model | Savings | Best For |
|-------|---------|----------|
| On-Demand | 0% | Unpredictable workloads, dev/test |
| Reserved 1yr | ~40% | Steady-state production |
| Reserved 3yr | ~60-72% | Long-term stable workloads |
| Spot | up to 90% | Batch, fault-tolerant, flexible timing |
| Savings Plans | up to 66% | Variable workloads needing flexibility |
| Dedicated Hosts | varies | Compliance, licensing requirements |

### Free Tier
- **Always Free**: Lambda (1M req/mo), DynamoDB (25GB), CloudWatch (10 metrics)
- **12 Months Free**: EC2 t2.micro (750hr/mo), S3 (5GB), RDS (750hr/mo)

## AWS CLI Basics

```bash
# Configure
aws configure
aws configure --profile dev

# Identity
aws sts get-caller-identity

# Query with JMESPath
aws ec2 describe-instances \\
  --query "Reservations[*].Instances[*].{ID:InstanceId,State:State.Name}" \\
  --output table

# Use named profile
export AWS_PROFILE=production
```

## Interview Questions

### Q1: What is the difference between a Region and an Availability Zone?
**Region**: Geographic area containing multiple AZs. Completely independent from other regions.
**AZ**: One or more datacenters within a region. Physically separate but connected via low-latency links.
Deploy across AZs for HA within a region; deploy across regions for global DR.

### Q2: What is the AWS Shared Responsibility Model?
AWS is responsible for security **OF** the cloud (physical infrastructure, hardware, managed service software).
Customers are responsible for security **IN** the cloud (data, IAM, OS patching on EC2, network config, application security).
The boundary shifts based on service type — EC2 (more customer responsibility) vs Lambda (less).

### Q3: What are the differences between On-Demand, Reserved, and Spot instances?
- **On-Demand**: Pay per second, no commitment. Most expensive. Use for unpredictable workloads.
- **Reserved**: 1 or 3-year commitment. Up to 72% savings. Use for steady-state production.
- **Spot**: Bid on unused capacity. Up to 90% savings. Can be interrupted with 2-min notice.
- **Savings Plans**: Commit to $/hour spend. More flexible than Reserved.

### Q4: How do you choose an AWS region?
1. Latency: Closest to your users
2. Compliance: Data residency laws
3. Service availability: Not all services in all regions
4. Cost: Prices vary (us-east-1 often cheapest)
5. DR: Pair with another region for disaster recovery
""")

w("fundamentals/02_aws_cli_basics.sh", """#!/bin/bash
# AWS CLI Basics — Essential Commands Reference

# ── Authentication ─────────────────────────────────────────────────────────────
aws configure
aws configure --profile dev
aws sts get-caller-identity
aws sts assume-role \\
  --role-arn arn:aws:iam::123456789:role/MyRole \\
  --role-session-name MySession

# ── EC2 ────────────────────────────────────────────────────────────────────────
aws ec2 describe-instances \\
  --query "Reservations[*].Instances[*].{ID:InstanceId,State:State.Name,Type:InstanceType}" \\
  --output table

aws ec2 run-instances \\
  --image-id ami-0c02fb55956c7d316 \\
  --instance-type t3.micro \\
  --key-name my-key-pair \\
  --security-group-ids sg-12345678 \\
  --subnet-id subnet-12345678 \\
  --count 1 \\
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=MyServer}]'

aws ec2 start-instances --instance-ids i-1234567890abcdef0
aws ec2 stop-instances --instance-ids i-1234567890abcdef0
aws ec2 terminate-instances --instance-ids i-1234567890abcdef0

# ── S3 ─────────────────────────────────────────────────────────────────────────
aws s3 ls
aws s3 ls s3://my-bucket
aws s3 mb s3://my-new-bucket --region us-east-1
aws s3 cp file.txt s3://my-bucket/
aws s3 cp s3://my-bucket/file.txt .
aws s3 sync ./local-dir s3://my-bucket/prefix/
aws s3 rm s3://my-bucket/file.txt
aws s3 rb s3://my-bucket --force

# ── IAM ────────────────────────────────────────────────────────────────────────
aws iam list-users --output table
aws iam list-roles --output table
aws iam create-user --user-name alice
aws iam attach-user-policy \\
  --user-name alice \\
  --policy-arn arn:aws:iam::aws:policy/ReadOnlyAccess

# ── Lambda ─────────────────────────────────────────────────────────────────────
aws lambda list-functions --output table
aws lambda invoke \\
  --function-name my-function \\
  --payload '{"key":"value"}' \\
  response.json
aws lambda update-function-code \\
  --function-name my-function \\
  --zip-file fileb://function.zip

# ── CloudFormation ─────────────────────────────────────────────────────────────
aws cloudformation create-stack \\
  --stack-name my-stack \\
  --template-body file://template.yaml \\
  --parameters ParameterKey=Env,ParameterValue=prod \\
  --capabilities CAPABILITY_IAM

aws cloudformation describe-stacks --stack-name my-stack
aws cloudformation delete-stack --stack-name my-stack

echo "AWS CLI reference complete!"
""")

w("fundamentals/03_pricing_calculator.md", """
# AWS Pricing — Calculator, Models & Cost Estimation

## Common Service Pricing (Approximate, us-east-1, 2024)

### Compute
```
EC2 Instances (Linux, On-Demand):
  t3.micro  (2 vCPU, 1GB):   ~$0.0104/hr  (~$7.59/mo)
  t3.small  (2 vCPU, 2GB):   ~$0.0208/hr  (~$15.18/mo)
  t3.medium (2 vCPU, 4GB):   ~$0.0416/hr  (~$30.37/mo)
  m5.large  (2 vCPU, 8GB):   ~$0.096/hr   (~$70.08/mo)
  m5.xlarge (4 vCPU, 16GB):  ~$0.192/hr   (~$140.16/mo)

Lambda:
  First 1M requests/month: FREE
  Additional: $0.20 per million requests
  Compute: $0.0000166667 per GB-second
```

### Storage
```
S3 Standard:          $0.023/GB/month
S3 Standard-IA:       $0.0125/GB/month
S3 Glacier Instant:   $0.004/GB/month
S3 Glacier Flexible:  $0.0036/GB/month
S3 Glacier Deep:      $0.00099/GB/month

EBS gp3:              $0.08/GB/month
EBS io2:              $0.125/GB/month + $0.065/IOPS
```

### Databases
```
RDS MySQL db.t3.micro:    ~$0.017/hr  (~$12.41/mo)
RDS MySQL db.m5.large:    ~$0.171/hr  (~$124.83/mo)
Aurora MySQL (per ACU):   ~$0.06/hr
DynamoDB On-Demand:       $1.25 per million write RCUs
                          $0.25 per million read RCUs
ElastiCache cache.t3.micro: ~$0.017/hr
```

### Networking
```
Data Transfer OUT (first 100GB/mo): $0.09/GB
Data Transfer OUT (next 9.9TB):     $0.085/GB
CloudFront (first 10TB/mo):         $0.0085/GB
VPN Connection:                     $0.05/hr
NAT Gateway:                        $0.045/hr + $0.045/GB
```

## Cost Estimation Examples

### Small Web App (Dev/Test)
```
EC2 t3.micro (1 instance):    $7.59/month
RDS db.t3.micro:              $12.41/month
S3 (10GB):                    $0.23/month
Data transfer (10GB):         $0.90/month
Total:                        ~$21/month
```

### Medium Production Web App
```
EC2 m5.large (2 instances):   $140/month
RDS db.m5.large Multi-AZ:     $250/month
ElastiCache cache.t3.medium:  $50/month
ALB:                          $20/month
S3 (100GB):                   $2.30/month
CloudFront (1TB):             $85/month
Total:                        ~$547/month
With Reserved Instances (1yr): ~$350/month
```

## Cost Optimization Tools

```bash
# AWS Cost Explorer
aws ce get-cost-and-usage \\
  --time-period Start=2024-01-01,End=2024-01-31 \\
  --granularity MONTHLY \\
  --metrics BlendedCost \\
  --group-by Type=DIMENSION,Key=SERVICE

# AWS Budgets
aws budgets create-budget \\
  --account-id 123456789012 \\
  --budget file://budget.json \\
  --notifications-with-subscribers file://notifications.json

# Trusted Advisor (cost checks)
aws support describe-trusted-advisor-checks --language en
aws support describe-trusted-advisor-check-result \\
  --check-id Qch7DwouX1  # Low utilization EC2 instances
```

## Interview Questions

### Q1: How do you reduce AWS costs for a predictable workload?
1. **Reserved Instances**: 1-year = ~40% savings, 3-year = ~60-72%
2. **Savings Plans**: Commit to $/hour, flexible instance family
3. **Right-sizing**: Use AWS Compute Optimizer recommendations
4. **Auto Scaling**: Scale down during off-peak hours
5. **S3 Lifecycle policies**: Move data to cheaper storage tiers
6. **Spot Instances**: For fault-tolerant batch workloads

### Q2: What is the difference between Reserved Instances and Savings Plans?
- **Reserved Instances**: Commit to specific instance type, region, OS. Up to 72% savings.
- **Savings Plans**: Commit to $/hour spend. Applies to any instance family/region/OS. More flexible. Up to 66% savings.
Use RI for: stable, predictable workloads with known configuration.
Use Savings Plans for: variable workloads, multiple regions, mixed instance types.
""")

print("Part 1 complete: fundamentals")
